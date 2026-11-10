import { evaluateOffer, type PolicyResult } from './policy';
import type { Offer, Policy } from './types';

export interface RankRow extends PolicyResult {
  offer: Offer;
}

export function rankOffers(offers: Offer[], quantity: number, policy: Policy): RankRow[] {
  return offers
    .map((offer) => ({ offer, ...evaluateOffer(offer, quantity, policy) }))
    .sort((a, b) =>
      Number(a.decision === 'rejected') - Number(b.decision === 'rejected') ||
      a.totalCents - b.totalCents ||
      a.offer.deliveryDays - b.offer.deliveryDays,
    );
}
