import type { Cents, Offer, Policy } from './types';

export type Decision = 'auto' | 'needs_approval' | 'rejected';
export type Rule = 'budget' | 'delivery' | 'supplier_allowed' | 'auto_limit';

export interface PolicyCheck {
  rule: Rule;
  passed: boolean;
  actual?: number;
  limit?: number;
}

export interface PolicyResult {
  decision: Decision;
  totalCents: Cents;
  checks: PolicyCheck[];
}

export function evaluateOffer(offer: Offer, quantity: number, policy: Policy): PolicyResult {
  const totalCents = offer.unitPriceCents * quantity;
  const hard: PolicyCheck[] = [
    { rule: 'budget', passed: totalCents <= policy.maxTotalCents, actual: totalCents, limit: policy.maxTotalCents },
    { rule: 'delivery', passed: offer.deliveryDays <= policy.maxDeliveryDays, actual: offer.deliveryDays, limit: policy.maxDeliveryDays },
    { rule: 'supplier_allowed', passed: !policy.blockedSupplierIds.includes(offer.supplierId) },
  ];
  const autoLimit: PolicyCheck = {
    rule: 'auto_limit', passed: totalCents <= policy.autoApproveUpToCents,
    actual: totalCents, limit: policy.autoApproveUpToCents,
  };
  const decision: Decision = hard.some((c) => !c.passed)
    ? 'rejected'
    : autoLimit.passed ? 'auto' : 'needs_approval';
  return { decision, totalCents, checks: [...hard, autoLimit] };
}
