import type { AgentDiscardReason, RunEvent } from '../core/events';
import type { PolicyResult } from '../core/policy';
import type { RankRow } from '../core/rank';
import type { Lang, Offer, Policy, PurchaseRequest, Scenario } from '../core/types';

export type Bubble =
  | { kind: 'agent'; text: string; tool: 'request_quote' | 'counter_offer'; round: number }
  | { kind: 'supplier'; text: string }
  | { kind: 'discarded'; reason: AgentDiscardReason };

export interface SupplierView {
  id: string;
  name: string;
  bubbles: Bubble[];
  offers: Offer[];
  awaitingReply: boolean;
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
}

export const emptyDesk: DeskState = { phase: 'idle', suppliers: [] };

export function startEvent(scenario: Scenario, lang: Lang): RunEvent {
  return {
    type: 'run_started',
    request: lang === 'en' ? { ...scenario.request, product: scenario.productEn } : scenario.request,
    policy: scenario.policy,
    suppliers: scenario.suppliers.map(({ id, name }) => ({ id, name })),
  };
}

function updateSupplier(state: DeskState, id: string, change: (s: SupplierView) => SupplierView): DeskState {
  return { ...state, suppliers: state.suppliers.map((s) => (s.id === id ? change(s) : s)) };
}

export function applyEvent(state: DeskState, e: RunEvent): DeskState {
  switch (e.type) {
    case 'run_started':
      return {
        phase: 'idle',
        request: e.request,
        policy: e.policy,
        suppliers: e.suppliers.map((s) => ({ ...s, bubbles: [], offers: [], awaitingReply: false })),
        activeSupplierId: e.suppliers[0]?.id,
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
    case 'error':
      return e.message === 'no_offers' ? { ...state, phase: 'failed' } : state;
  }
}

export function replay(events: RunEvent[]): DeskState {
  return events.reduce(applyEvent, emptyDesk);
}
