import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { LLM, LLMRequest, LLMUsage } from './llm';

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GeminiFailure =
  | { kind: 'busy'; waitMs: number } // 503 de alta demanda: se reintenta en segundos
  | { kind: 'rate'; waitMs: number } // 429 por minuto: se espera lo que pide la API
  | { kind: 'exhausted' } // cuota diaria agotada o modelo no disponible: se pasa al siguiente modelo
  | { kind: 'auth' } // clave inválida: no tiene sentido reintentar ni cambiar de modelo
  | { kind: 'other' };

export function classifyError(error: unknown): GeminiFailure {
  const text = String(error);
  if (/API key not valid|API_KEY_INVALID|"code":\s*(401|403)/.test(text)) return { kind: 'auth' };
  if (/"code":\s*404|PerDay|no longer available|not found for API/i.test(text)) return { kind: 'exhausted' };
  if (/"code":\s*503|UNAVAILABLE/.test(text)) return { kind: 'busy', waitMs: 2500 };
  if (/"code":\s*429|RESOURCE_EXHAUSTED/.test(text)) {
    const seconds = text.match(/retry in ([\d.]+)s/i)?.[1] ?? text.match(/"retryDelay":\s*"([\d.]+)s"/)?.[1];
    return { kind: 'rate', waitMs: Math.min(Math.ceil(Number(seconds ?? 30)) + 1, 65) * 1000 };
  }
  return { kind: 'other' };
}

/** Modelos con capa gratuita que se agregan como respaldo a lo que diga GEMINI_MODEL. */
export const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

/** La cadena configurada, seguida de los respaldos que falten. */
export function modelChain(configured: string | undefined): string[] {
  const chain = (configured ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return [...new Set([...chain, ...FALLBACK_MODELS])];
}

/**
 * Adaptador de Gemini con salida JSON validada.
 * `models` es una cadena de respaldo: si un modelo agota su cuota diaria, se usa el siguiente.
 */
export class GeminiLLM implements LLM {
  private ai: GoogleGenAI;
  private models: string[];
  private patient: boolean;
  lastUsage?: LLMUsage & { model: string };

  /** patient: ante un límite por minuto, esperar y reintentar (scripts). En el sitio se corta enseguida. */
  constructor(apiKey: string, models: string | string[], options: { patient?: boolean } = {}) {
    this.ai = new GoogleGenAI({ apiKey });
    this.models = (Array.isArray(models) ? models : models.split(',')).map((m) => m.trim()).filter(Boolean);
    if (this.models.length === 0) throw new Error('GeminiLLM: no hay modelos configurados');
    this.patient = options.patient ?? true;
  }

  get model(): string {
    return this.models[0];
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    const schemaText = JSON.stringify(z.toJSONSchema(req.schema));
    let lastError: unknown;
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      const model = this.model;
      try {
        const startedAt = Date.now();
        const res = await this.ai.models.generateContent({
          model,
          contents: req.prompt,
          config: {
            systemInstruction: `${req.system}\n\nRespondé únicamente con JSON válido que cumpla este JSON Schema:\n${schemaText}`,
            responseMimeType: 'application/json',
          },
        });
        const parsed = req.schema.parse(JSON.parse(res.text ?? ''));
        this.lastUsage = {
          model,
          ms: Date.now() - startedAt,
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
          attempts: attempt,
        };
        return parsed;
      } catch (error) {
        lastError = error;
        const failure = classifyError(error);
        // Observabilidad: tipo de falla, modelo e intento. El texto del error de Google no incluye la clave.
        console.error(`[gemini] model=${model} attempt=${attempt} kind=${failure.kind} ${String(error).replace(/\s+/g, ' ').slice(0, process.env.LLM_DEBUG ? 400 : 160)}`);
        if (failure.kind === 'exhausted') {
          if (this.models.length === 1) break;
          this.models.shift(); // el modelo queda descartado para el resto de la corrida
          attempt -= 1; // cambiar de modelo no consume un intento
          continue;
        }
        if (failure.kind === 'auth') break;
        if (failure.kind === 'other') {
          if (attempt >= 2) break;
          continue;
        }
        if (failure.kind === 'rate' && !this.patient) break;
        await sleep(failure.waitMs);
      }
    }
    throw lastError;
  }
}
