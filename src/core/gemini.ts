import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { LLM, LLMRequest } from './llm';

export class GeminiLLM implements LLM {
  private ai: GoogleGenAI;

  constructor(apiKey: string, private model: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    const schemaText = JSON.stringify(z.toJSONSchema(req.schema));
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
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
      }
    }
    throw lastError;
  }
}
