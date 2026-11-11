import type { z } from 'zod';

export interface LLMRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

export interface LLMUsage {
  model?: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
}

export interface LLM {
  generateJson<T>(req: LLMRequest<T>): Promise<T>;
  /** Consumo de la última llamada exitosa, si el adaptador lo mide. */
  lastUsage?: LLMUsage;
}

export class ScriptedLLM implements LLM {
  calls: { system: string; prompt: string }[] = [];
  private queue: unknown[];

  constructor(responses: unknown[]) {
    this.queue = [...responses];
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    this.calls.push({ system: req.system, prompt: req.prompt });
    if (this.queue.length === 0) throw new Error('ScriptedLLM: sin respuestas');
    return req.schema.parse(this.queue.shift());
  }
}
