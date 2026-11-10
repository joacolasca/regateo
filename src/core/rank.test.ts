import { describe, expect, it } from 'vitest';
import { rankOffers } from './rank';
import type { Offer, Policy } from './types';

const policy: Policy = {
  maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000,
  maxDeliveryDays: 5, blockedSupplierIds: [],
};
const o = (supplierId: string, unitPriceCents: number, deliveryDays: number): Offer =>
  ({ supplierId, unitPriceCents, deliveryDays, round: 1 });

describe('rankOffers', () => {
  it('pone primero las que cumplen las reglas, después por total', () => {
    const rows = rankOffers([o('barato-tarde', 21_900, 7), o('caro', 23_800, 5), o('medio', 23_200, 5)], 500, policy);
    expect(rows.map((r) => r.offer.supplierId)).toEqual(['medio', 'caro', 'barato-tarde']);
    expect(rows[2].decision).toBe('rejected');
  });

  it('desempata por plazo de entrega', () => {
    const rows = rankOffers([o('lento', 20_000, 5), o('rapido', 20_000, 3)], 500, policy);
    expect(rows[0].offer.supplierId).toBe('rapido');
  });

  it('devuelve lista vacía sin ofertas', () => {
    expect(rankOffers([], 500, policy)).toEqual([]);
  });
});
