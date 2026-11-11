import type { AgentDiscardReason, RunEvent } from '../core/events';
import { evaluateOffer, type PolicyResult } from '../core/policy';
import { rankOffers, type RankRow } from '../core/rank';
import type { Lang, Offer, Policy, PurchaseRequest, Scenario } from '../core/types';

export type Bubble =
  | { kind: 'agent'; text: string; tool: 'request_quote' | 'counter_offer'; round: number }
  | { kind: 'supplier'; text: string; flagged?: string[] }
  | { kind: 'discarded'; reason: AgentDiscardReason };

export interface SupplierView {
  id: string;
  name: string;
  bubbles: Bubble[];
  offers: Offer[];
  awaitingReply: boolean;
  flagged: string[];
}

export type Phase = 'idle' | 'quoting' | 'negotiating' | 'comparing' | 'decided' | 'failed';

export interface DeskState {
  phase: Phase;
  request?: PurchaseRequest;
  policy?: Policy;
  suppliers: SupplierView[];
  activeSupplierId?: string;
  ranking?: RankRow[];
  recommendation?: { supplierId: string; explanation: string; forced: boolean };
  verdict?: PolicyResult;
  trace: Extract<RunEvent, { type: 'llm_call' }>[];
  /** Todos los eventos de la corrida, para exportar como registro de auditoría. */
  log: RunEvent[];
}

export const emptyDesk: DeskState = { phase: 'idle', suppliers: [], trace: [], log: [] };

export function startEvent(scenario: Scenario, lang: Lang, policy: Policy = scenario.policy): RunEvent {
  return {
    type: 'run_started',
    request: lang === 'en' ? { ...scenario.request, product: scenario.productEn } : scenario.request,
    policy,
    suppliers: scenario.suppliers.map(({ id, name }) => ({ id, name })),
  };
}

function updateSupplier(state: DeskState, id: string, change: (s: SupplierView) => SupplierView): DeskState {
  return { ...state, suppliers: state.suppliers.map((s) => (s.id === id ? change(s) : s)) };
}

export function applyEvent(state: DeskState, e: RunEvent): DeskState {
  const next = reduce(state, e);
  return { ...next, log: e.type === 'run_started' ? [e] : [...state.log, e] };
}

function reduce(state: DeskState, e: RunEvent): DeskState {
  switch (e.type) {
    case 'run_started':
      return {
        phase: 'idle',
        request: e.request,
        policy: e.policy,
        suppliers: e.suppliers.map((s) => ({ ...s, bubbles: [], offers: [], awaitingReply: false, flagged: [] })),
        activeSupplierId: e.suppliers[0]?.id,
        trace: [],
        log: [],
      };
    case 'agent_message':
      return {
        ...updateSupplier(state, e.supplierId, (s) => ({
          ...s,
          awaitingReply: true,
          bubbles: [...s.bubbles, { kind: 'agent', text: e.text, tool: e.tool, round: e.round }],
        })),
        phase: e.tool === 'counter_offer' ? 'negotiating' : state.phase === 'idle' ? 'quoting' : state.phase,
        activeSupplierId: e.supplierId,
      };
    case 'supplier_message':
      return {
        ...updateSupplier(state, e.supplierId, (s) => ({
          ...s,
          awaitingReply: false,
          bubbles: [...s.bubbles, { kind: 'supplier', text: e.text }],
          offers: [...s.offers, e.offer],
        })),
        activeSupplierId: e.supplierId,
      };
    case 'round_discarded':
      return updateSupplier(state, e.supplierId, (s) => ({
        ...s,
        awaitingReply: false,
        bubbles: [...s.bubbles, { kind: 'discarded', reason: e.reason }],
      }));
    case 'ranking':
      return { ...state, phase: 'comparing', ranking: e.rows };
    case 'recommendation':
      return {
        ...state,
        recommendation: { supplierId: e.supplierId, explanation: e.explanation, forced: e.forced },
        activeSupplierId: e.supplierId,
      };
    case 'policy_result':
      return { ...state, phase: 'decided', verdict: e.result };
    case 'manipulation_flagged':
      return updateSupplier(state, e.supplierId, (s) => {
        const bubbles = [...s.bubbles];
        const last = bubbles.at(-1);
        if (last?.kind === 'supplier') bubbles[bubbles.length - 1] = { ...last, flagged: e.kinds };
        return { ...s, bubbles, flagged: [...new Set([...s.flagged, ...e.kinds])] };
      });
    case 'llm_call':
      return { ...state, trace: [...state.trace, e] };
    case 'error':
      return e.message === 'no_offers' ? { ...state, phase: 'failed' } : state;
  }
}

/** Guarda todos los eventos para poder exportar la corrida completa. */
export function replay(events: RunEvent[]): DeskState {
  return events.reduce(applyEvent, emptyDesk);
}

export interface DeskView {
  ranking?: RankRow[];
  recommendedId?: string;
  verdict?: PolicyResult;
  /** true cuando el veredicto se recalculó en el navegador con reglas editadas por el visitante. */
  whatIf: boolean;
}

/** Con las reglas originales muestra lo que decidió la corrida; con reglas editadas, recalcula con el mismo código del servidor. */
export function deriveView(desk: DeskState, policy: Policy | undefined): DeskView {
  const original: DeskView = { ranking: desk.ranking, recommendedId: desk.recommendation?.supplierId, verdict: desk.verdict, whatIf: false };
  if (!policy || !desk.request || policy === desk.policy || desk.phase !== 'decided') return original;
  const offers = desk.suppliers.flatMap((s) => s.offers.slice(-1));
  const ranking = rankOffers(offers, desk.request.quantity, policy);
  const top = ranking[0];
  if (!top) return original;
  return {
    ranking,
    recommendedId: top.offer.supplierId,
    verdict: evaluateOffer(top.offer, desk.request.quantity, policy),
    whatIf: true,
  };
}
