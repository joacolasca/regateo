import { describe, expect, it } from 'vitest';
import { ScriptedLLM } from './llm';
import { supplierReply } from './supplier';
import type { PurchaseRequest, SupplierProfile } from './types';

const profile: SupplierProfile = {
  id: 's1', name: 'Envases Sur', persona: 'Directo, cede poco.',
  listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5,
};
const request: PurchaseRequest = { product: 'vasos térmicos 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 };
const history = [{ from: 'agent' as const, text: '¿Precio y plazo?' }];

describe('supplierReply', () => {
  it('devuelve la oferta cuando respeta el piso y el plazo', async () => {
    const llm = new ScriptedLLM([{ message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 }]);
    const r = await supplierReply(llm, profile, request, history, 2);
    expect(r).toEqual({
      ok: true, message: '$232, el lunes.',
      offer: { supplierId: 's1', unitPriceCents: 23_200, deliveryDays: 5, round: 2 },
    });
  });

  it('incluye la ficha oculta en el system y la conversación en el prompt', async () => {
    const llm = new ScriptedLLM([{ message: 'ok', unitPriceCents: 24_800, deliveryDays: 6 }]);
    await supplierReply(llm, profile, request, history, 1);
    expect(llm.calls[0].system).toContain('22500');
    expect(llm.calls[0].prompt).toContain('¿Precio y plazo?');
  });

  it('descarta una oferta por debajo del piso', async () => {
    const llm = new ScriptedLLM([{ message: 'Te lo dejo en $200.', unitPriceCents: 20_000, deliveryDays: 5 }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'below_floor' });
  });

  it('descarta un plazo más rápido que el mínimo', async () => {
    const llm = new ScriptedLLM([{ message: 'Mañana.', unitPriceCents: 24_000, deliveryDays: 1 }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'too_fast' });
  });

  it('descarta una salida inválida del LLM', async () => {
    const llm = new ScriptedLLM([{ message: 'hola' }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'invalid_output' });
  });
});
