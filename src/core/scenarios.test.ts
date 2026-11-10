import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';

describe('scenarios', () => {
  it('tienen ids únicos y al menos 3 proveedores', () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    for (const s of scenarios) expect(s.suppliers.length).toBeGreaterThanOrEqual(3);
  });

  it('cada proveedor tiene piso <= lista y plazo mínimo <= plazo normal', () => {
    for (const sup of scenarios.flatMap((s) => s.suppliers)) {
      expect(sup.floorUnitPriceCents).toBeLessThanOrEqual(sup.listUnitPriceCents);
      expect(sup.fastestDeliveryDays).toBeLessThanOrEqual(sup.deliveryDays);
    }
  });

  it('cada escenario tiene al menos un proveedor que puede cumplir las reglas en su piso', () => {
    for (const s of scenarios) {
      const feasible = s.suppliers.some((sup) =>
        sup.floorUnitPriceCents * s.request.quantity <= s.policy.maxTotalCents &&
        sup.fastestDeliveryDays <= s.policy.maxDeliveryDays &&
        !s.policy.blockedSupplierIds.includes(sup.id));
      expect(feasible).toBe(true);
    }
  });
});
