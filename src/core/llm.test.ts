import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ScriptedLLM } from './llm';

const schema = z.object({ n: z.number() });

describe('ScriptedLLM', () => {
  it('devuelve las respuestas en orden y registra las llamadas', async () => {
    const llm = new ScriptedLLM([{ n: 1 }, { n: 2 }]);
    expect(await llm.generateJson({ system: 's', prompt: 'a', schema })).toEqual({ n: 1 });
    expect(await llm.generateJson({ system: 's', prompt: 'b', schema })).toEqual({ n: 2 });
    expect(llm.calls.map((c) => c.prompt)).toEqual(['a', 'b']);
  });

  it('falla si la respuesta no cumple el schema', async () => {
    const llm = new ScriptedLLM([{ n: 'x' }]);
    await expect(llm.generateJson({ system: 's', prompt: 'a', schema })).rejects.toThrow();
  });

  it('falla si se queda sin guion', async () => {
    const llm = new ScriptedLLM([]);
    await expect(llm.generateJson({ system: 's', prompt: 'a', schema })).rejects.toThrow('ScriptedLLM: sin respuestas');
  });
});
