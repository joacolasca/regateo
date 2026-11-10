import { describe, expect, it } from 'vitest';
import { runAgent } from './agent';
import type { RunEvent } from './events';
import { ScriptedLLM } from './llm';
import type { Scenario } from './types';

const scenario: Scenario = {
  id: 't',
  request: { product: 'vasos térmicos 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 },
  policy: { maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000, maxDeliveryDays: 5, blockedSupplierIds: [] },
  suppliers: [
    { id: 's1', name: 'Envases Sur', persona: 'Directo.', listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5 },
    { id: 's2', name: 'PackNorte', persona: 'Rígido.', listUnitPriceCents: 25_100, floorUnitPriceCents: 24_500, deliveryDays: 5, fastestDeliveryDays: 5 },
  ],
};

async function run(agentScript: unknown[], supplierScript: unknown[]) {
  const events: RunEvent[] = [];
  const result = await runAgent(
    { agentLlm: new ScriptedLLM(agentScript), supplierLlm: new ScriptedLLM(supplierScript) },
    scenario,
    (e) => events.push(e),
  );
  return { events, result };
}

describe('runAgent', () => {
  it('cotiza, negocia, recomienda y el servidor decide', async () => {
    const { events, result } = await run(
      [
        { tool: 'request_quote', supplierId: 's1', message: '¿Precio y plazo?' },
        { tool: 'request_quote', supplierId: 's2', message: '¿Precio y plazo?' },
        { tool: 'counter_offer', supplierId: 's1', message: 'Si llegás el lunes a $225, cierro.' },
        { tool: 'recommend', supplierId: 's1', explanation: 'Cumple fecha y presupuesto.' },
      ],
      [
        { message: '$248, el martes.', unitPriceCents: 24_800, deliveryDays: 6 },
        { message: '$251, el lunes.', unitPriceCents: 25_100, deliveryDays: 5 },
        { message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 },
      ],
    );
    expect(events.map((e) => e.type)).toEqual([
      'run_started',
      'agent_message', 'supplier_message',
      'agent_message', 'supplier_message',
      'agent_message', 'supplier_message',
      'ranking', 'recommendation', 'policy_result',
    ]);
    expect(result).toEqual({ status: 'done', supplierId: 's1', decision: 'needs_approval', totalCents: 11_600_000, forced: false });
  });

  it('conserva la oferta anterior si el proveedor baja del piso', async () => {
    const { events, result } = await run(
      [
        { tool: 'request_quote', supplierId: 's1', message: '¿Precio?' },
        { tool: 'counter_offer', supplierId: 's1', message: 'Bajá a $200.' },
        { tool: 'recommend', supplierId: 's1', explanation: 'Única oferta.' },
      ],
      [
        { message: '$240, el lunes.', unitPriceCents: 24_000, deliveryDays: 5 },
        { message: '$200.', unitPriceCents: 20_000, deliveryDays: 5 },
      ],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's1', reason: 'below_floor' });
    expect(result).toMatchObject({ status: 'done', totalCents: 12_000_000 });
  });

  it('no permite más de 3 rondas por proveedor', async () => {
    const ask = { tool: 'counter_offer', supplierId: 's1', message: 'Bajá más.' };
    const reply = { message: '$240.', unitPriceCents: 24_000, deliveryDays: 5 };
    const { events } = await run(
      [{ tool: 'request_quote', supplierId: 's1', message: '¿Precio?' }, ask, ask, ask, { tool: 'recommend', supplierId: 's1', explanation: 'Listo.' }],
      [reply, reply, reply],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's1', reason: 'round_limit' });
  });

  it('rechaza recomendar a un proveedor sin oferta y sigue', async () => {
    const { events, result } = await run(
      [
        { tool: 'recommend', supplierId: 's2', explanation: 'Porque sí.' },
        { tool: 'request_quote', supplierId: 's2', message: '¿Precio?' },
        { tool: 'recommend', supplierId: 's2', explanation: 'Ahora sí.' },
      ],
      [{ message: '$245, el lunes.', unitPriceCents: 24_500, deliveryDays: 5 }],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's2', reason: 'no_offer_yet' });
    expect(result).toMatchObject({ status: 'done', supplierId: 's2', decision: 'rejected' });
  });

  it('si el LLM del agente falla, recomienda la mejor oferta que tenga', async () => {
    const { events, result } = await run(
      [{ tool: 'request_quote', supplierId: 's1', message: '¿Precio?' }],
      [{ message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 }],
    );
    expect(events).toContainEqual({ type: 'error', message: 'agent_llm_failed' });
    expect(result).toMatchObject({ status: 'done', supplierId: 's1', forced: true });
  });

  it('falla limpio si no hay ninguna oferta', async () => {
    const { events, result } = await run([], []);
    expect(events.at(-1)).toEqual({ type: 'error', message: 'no_offers' });
    expect(result).toEqual({ status: 'failed' });
  });
});
