import { describe, expect, it } from 'vitest';
import { classifyError, FALLBACK_MODELS, modelChain } from './gemini';

describe('classifyError', () => {
  it('cuota diaria o modelo no disponible: pasar al siguiente modelo', () => {
    expect(classifyError('{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}')).toEqual({ kind: 'exhausted' });
    expect(classifyError('{"error":{"code":404,"message":"models/x is not found for API version v1"}}')).toEqual({ kind: 'exhausted' });
  });

  it('límite por minuto: esperar lo que indica la API', () => {
    expect(classifyError('{"error":{"code":429,"message":"Please retry in 12.3s"}}')).toEqual({ kind: 'rate', waitMs: 14_000 });
  });

  it('alta demanda: reintentar en segundos', () => {
    expect(classifyError('{"error":{"code":503,"status":"UNAVAILABLE"}}')).toEqual({ kind: 'busy', waitMs: 2500 });
  });

  it('llamada colgada que se cortó por tiempo: reintentar enseguida', () => {
    expect(classifyError(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))).toEqual({ kind: 'busy', waitMs: 500 });
  });

  it('clave inválida: cortar sin reintentar', () => {
    expect(classifyError('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}')).toEqual({ kind: 'auth' });
  });

  it('cualquier otra cosa', () => {
    expect(classifyError(new SyntaxError('Unexpected token'))).toEqual({ kind: 'other' });
  });
});

describe('modelChain', () => {
  it('respeta el orden configurado y agrega los respaldos que faltan', () => {
    expect(modelChain('gemini-3.8-flash')).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    expect(modelChain(undefined)).toEqual(FALLBACK_MODELS);
    expect(modelChain(' a , b ')).toEqual(['a', 'b', ...FALLBACK_MODELS]);
  });
});
