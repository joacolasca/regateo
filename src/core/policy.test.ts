import { describe, expect, it } from 'vitest';
import { evaluateOffer } from './policy';
import type { Offer, Policy } from './types';

const policy: Policy = {
  maxTotalCents: 12_000_000,
  autoApproveUpToCents: 8_000_000,
  maxDeliveryDays: 5,
  blockedSupplierIds: ['blocked'],
};
const offer = (over: Partial<Offer> = {}): Offer => ({
  supplierId: 's1', unitPriceCents: 15_000, deliveryDays: 5, round: 1, ...over,
});

describe('evaluateOffer', () => {
  it('compra sola cuando todo cumple y está bajo el umbral', () => {
    const r = evaluateOffer(offer(), 500, policy);
    expect(r.totalCents).toBe(7_500_000);
    expect(r.decision).toBe('auto');
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('el umbral es inclusivo', () => {
    expect(evaluateOffer(offer({ unitPriceCents: 16_000 }), 500, policy).decision).toBe('auto');
  });

  it('pide aprobación sobre el umbral y dentro del presupuesto', () => {
    const r = evaluateOffer(offer({ unitPriceCents: 23_200 }), 500, policy);
    expect(r.decision).toBe('needs_approval');
    expect(r.checks.find((c) => c.rule === 'auto_limit')).toMatchObject({
      passed: false, actual: 11_600_000, limit: 8_000_000,
    });
  });

  it('rechaza si supera el presupuesto', () => {
    expect(evaluateOffer(offer({ unitPriceCents: 25_100 }), 500, policy).decision).toBe('rejected');
  });

  it('rechaza si llega tarde', () => {
    expect(evaluateOffer(offer({ deliveryDays: 6 }), 500, policy).decision).toBe('rejected');
  });

  it('rechaza a un proveedor bloqueado', () => {
    const r = evaluateOffer(offer({ supplierId: 'blocked' }), 500, policy);
    expect(r.decision).toBe('rejected');
    expect(r.checks.find((c) => c.rule === 'supplier_allowed')?.passed).toBe(false);
  });
});
