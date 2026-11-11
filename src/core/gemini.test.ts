import { describe, expect, it } from 'vitest';
import { classifyError } from './gemini';

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

  it('cualquier otra cosa', () => {
    expect(classifyError(new SyntaxError('Unexpected token'))).toEqual({ kind: 'other' });
  });
});
