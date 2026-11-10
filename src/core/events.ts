import type { PolicyResult } from './policy';
import type { RankRow } from './rank';
import type { DiscardReason } from './supplier';
import type { Offer, Policy, PurchaseRequest } from './types';

export type AgentDiscardReason = DiscardReason | 'round_limit' | 'no_offer_yet' | 'unknown_supplier';

export type RunEvent =
  | { type: 'run_started'; request: PurchaseRequest; policy: Policy; suppliers: { id: string; name: string }[] }
  | { type: 'agent_message'; supplierId: string; tool: 'request_quote' | 'counter_offer'; round: number; text: string }
  | { type: 'supplier_message'; supplierId: string; text: string; offer: Offer }
  | { type: 'round_discarded'; supplierId: string; reason: AgentDiscardReason }
  | { type: 'ranking'; rows: RankRow[] }
  | { type: 'recommendation'; supplierId: string; explanation: string; forced: boolean }
  | { type: 'policy_result'; supplierId: string; result: PolicyResult }
  | { type: 'error'; message: 'agent_llm_failed' | 'no_offers' };

export type Emit = (event: RunEvent) => void;
