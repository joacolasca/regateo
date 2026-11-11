import { describe, expect, it } from 'vitest';
import { getScenario } from '../core/scenarios';
import { evaluateOffer } from '../core/policy';
import { applyEvent, deriveView, emptyDesk, replay, startEvent } from './desk-state';

const scenario = getScenario('vasos-cafeteria')!;
const offer = { supplierId: 'envases-sur', unitPriceCents: 24_500, deliveryDays: 5, round: 1 };

describe('desk-state', () => {
  it('arranca con los proveedores del escenario y el producto en el idioma pedido', () => {
    const state = applyEvent(emptyDesk, startEvent(scenario, 'en'));
    expect(state.phase).toBe('idle');
    expect(state.request?.product).toBe('8 oz insulated cups');
    expect(state.suppliers.map((s) => s.id)).toEqual(['envases-sur', 'descartables-ya', 'packnorte']);
  });

  it('sigue la conversación y el historial de ofertas de cada proveedor', () => {
    const state = replay([
      startEvent(scenario, 'es'),
      { type: 'agent_message', supplierId: 'envases-sur', tool: 'request_quote', round: 1, text: 'hola' },
    ]);
    expect(state.phase).toBe('quoting');
    expect(state.suppliers[0].awaitingReply).toBe(true);

    const next = replay([
      startEvent(scenario, 'es'),
      { type: 'agent_message', supplierId: 'envases-sur', tool: 'request_quote', round: 1, text: 'hola' },
      { type: 'supplier_message', supplierId: 'envases-sur', text: '$245', offer },
      { type: 'agent_message', supplierId: 'envases-sur', tool: 'counter_offer', round: 2, text: 'bajá' },
      { type: 'round_discarded', supplierId: 'envases-sur', reason: 'below_floor' },
    ]);
    expect(next.phase).toBe('negotiating');
    expect(next.suppliers[0].offers).toEqual([offer]);
    expect(next.suppliers[0].awaitingReply).toBe(false);
    expect(next.suppliers[0].bubbles.map((b) => b.kind)).toEqual(['agent', 'supplier', 'agent', 'discarded']);
  });

  it('marca la corrida como fallida solo cuando no hubo ofertas', () => {
    const base = applyEvent(emptyDesk, startEvent(scenario, 'es'));
    expect(applyEvent(base, { type: 'error', message: 'agent_llm_failed' }).phase).toBe('idle');
    expect(applyEvent(base, { type: 'error', message: 'no_offers' }).phase).toBe('failed');
  });

  it('recalcula ranking y veredicto cuando el visitante edita las reglas', () => {
    const late = { supplierId: 'descartables-ya', unitPriceCents: 22_400, deliveryDays: 7, round: 1 };
    const desk = replay([
      startEvent(scenario, 'es'),
      { type: 'supplier_message', supplierId: 'envases-sur', text: 'a', offer },
      { type: 'supplier_message', supplierId: 'descartables-ya', text: 'b', offer: late },
      { type: 'recommendation', supplierId: 'envases-sur', explanation: 'x', forced: false },
      { type: 'policy_result', supplierId: 'envases-sur', result: evaluateOffer(offer, 500, scenario.policy) },
    ]);
    expect(deriveView(desk, desk.policy)).toMatchObject({ whatIf: false, recommendedId: 'envases-sur' });

    const relaxed = deriveView(desk, { ...scenario.policy, maxDeliveryDays: 7, autoApproveUpToCents: 12_000_000 });
    expect(relaxed).toMatchObject({ whatIf: true, recommendedId: 'descartables-ya' });
    expect(relaxed.verdict?.decision).toBe('auto');

    const blocked = deriveView(desk, { ...scenario.policy, blockedSupplierIds: ['envases-sur'] });
    expect(blocked.verdict?.decision).toBe('rejected');
  });

  it('guarda el registro completo de eventos y lo reinicia con cada corrida', () => {
    const first = replay([startEvent(scenario, 'es'), { type: 'error', message: 'agent_llm_failed' }]);
    expect(first.log.map((e) => e.type)).toEqual(['run_started', 'error']);
    expect(applyEvent(first, startEvent(scenario, 'es')).log).toHaveLength(1);
  });
});
