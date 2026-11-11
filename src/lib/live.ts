import { z } from 'zod';
import { GeminiLLM, modelChain } from '../core/gemini';
import { getScenario } from '../core/scenarios';
import type { Scenario } from '../core/types';
import { Throttle } from './throttle';

// Lo que comparten la corrida en vivo de la página (/api/run) y la API pública (/api/v1/negotiate).

/** El visitante puede cambiar las reglas, pero solo con números acotados: no hay texto libre que llegue al modelo. */
export const PolicyInput = z.object({
  maxTotalCents: z.number().int().min(1).max(1e12),
  autoApproveUpToCents: z.number().int().min(0).max(1e12),
  maxDeliveryDays: z.number().int().min(1).max(60),
  blockedSupplierIds: z.array(z.string().max(40)).max(5),
});

export const RunRequest = z.object({
  scenarioId: z.string().max(60),
  lang: z.enum(['es', 'en']).default('es'),
  policy: PolicyInput.optional(),
});

export type RunRequest = z.infer<typeof RunRequest>;

/** Un freno compartido por instancia. El tope real de gasto es la capa gratuita del modelo, que no factura. */
const throttle = new Throttle({
  perKey: 3, perKeyWindowMs: 10 * 60_000,
  global: 40, globalWindowMs: 24 * 60 * 60_000,
});

export type Prepared =
  | { ok: true; scenario: Scenario; lang: 'es' | 'en'; llm: GeminiLLM }
  | { ok: false; status: number; error: 'bad_request' | 'unknown_scenario' | 'live_unavailable' | 'rate_limited' };

export function prepareRun(body: unknown, req: Request, options: { patient: boolean }): Prepared {
  const parsed = RunRequest.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: 'bad_request' };
  const base = getScenario(parsed.data.scenarioId);
  if (!base) return { ok: false, status: 404, error: 'unknown_scenario' };

  const known = new Set(base.suppliers.map((s) => s.id));
  const policy = parsed.data.policy
    ? { ...parsed.data.policy, blockedSupplierIds: parsed.data.policy.blockedSupplierIds.filter((id) => known.has(id)) }
    : base.policy;

  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY) return { ok: false, status: 503, error: 'live_unavailable' };

  const visitor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!throttle.allow(visitor)) return { ok: false, status: 429, error: 'rate_limited' };

  return {
    ok: true,
    scenario: { ...base, policy },
    lang: parsed.data.lang,
    llm: new GeminiLLM(GEMINI_API_KEY, modelChain(GEMINI_MODEL), options),
  };
}
