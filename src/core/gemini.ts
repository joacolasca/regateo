import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { LLM, LLMRequest } from './llm';

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// La capa gratuita limita pedidos por minuto: ante un 429 se espera lo que indica la API y se reintenta.
function retryDelayMs(error: unknown): number | null {
  const text = String(error);
  if (!text.includes('429')) return null;
  const seconds = text.match(/retry in ([\d.]+)s/i)?.[1] ?? text.match(/"retryDelay":\s*"([\d.]+)s"/)?.[1];
  return Math.min(Math.ceil(Number(seconds ?? 30)) + 1, 65) * 1000;
}

export class GeminiLLM implements LLM {
  private ai: GoogleGenAI;

  constructor(apiKey: string, private model: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    const schemaText = JSON.stringify(z.toJSONSchema(req.schema));
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents: req.prompt,
          config: {
            systemInstruction: `${req.system}\n\nRespondé únicamente con JSON válido que cumpla este JSON Schema:\n${schemaText}`,
            responseMimeType: 'application/json',
          },
        });
        return req.schema.parse(JSON.parse(res.text ?? ''));
      } catch (error) {
        lastError = error;
        if (process.env.LLM_DEBUG) console.error('[gemini]', String(error).slice(0, 300));
        const wait = retryDelayMs(error);
        if (wait === null && attempt >= 1) break;
        if (wait !== null) await sleep(wait);
      }
    }
    throw lastError;
  }
}
