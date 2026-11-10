import { describe, expect, it } from 'vitest';
import { optimalSupplierId, scoreRun, summarize } from './evals';
import type { RunEvent } from './events';
import { evaluateOffer } from './policy';
import { rankOffers } from './rank';
import { getScenario } from './scenarios';
import type { Offer } from './types';

const scenario = getScenario('vasos-cafeteria')!;
const offer = (supplierId: string, unitPriceCents: number, deliveryDays: number, round: number): Offer =>
  ({ supplierId, unitPriceCents, deliveryDays, round });

function events(final: Offer, others: Offer[], first: Offer, forced = false): RunEvent[] {
  const { quantity } = scenario.request;
  return [
    { type: 'run_started', request: scenario.request, policy: scenario.policy, suppliers: [] },
    { type: 'agent_message', supplierId: first.supplierId, tool: 'request_quote', round: 1, text: 'hola' },
    { type: 'supplier_message', supplierId: first.supplierId, text: 'x', offer: first },
    { type: 'round_discarded', supplierId: first.supplierId, reason: 'below_floor' },
    { type: 'supplier_message', supplierId: final.supplierId, text: 'y', offer: final },
    { type: 'ranking', rows: rankOffers([final, ...others], quantity, scenario.policy) },
    { type: 'recommendation', supplierId: final.supplierId, explanation: 'z', forced },
    { type: 'policy_result', supplierId: final.supplierId, result: evaluateOffer(final, quantity, scenario.policy) },
  ];
}

describe('optimalSupplierId', () => {
  it('es el proveedor más barato en su piso entre los que pueden cumplir las reglas', () => {
    expect(optimalSupplierId(scenario)).toBe('envases-sur');
  });
});

describe('scoreRun', () => {
  it('mide factibilidad, elección y cuánto del margen negociable capturó', () => {
    const first = offer('envases-sur', 24_500, 5, 1);
    const final = offer('envases-sur', 23_500, 5, 2);
    const s = scoreRun(scenario, events(final, [offer('packnorte', 25_600, 4, 1)], first));
    expect(s).toMatchObject({
      completed: true, feasible: true, pickedTopRanked: true, pickedOptimalSupplier: true,
      forced: false, discardedRounds: 1, agentMessages: 1,
      savedCents: 500_000,
    });
    expect(s.marginCaptured).toBeCloseTo(0.5);
  });

  it('marca como no factible una recomendación que el servidor rechaza', () => {
    const o = offer('descartables-ya', 22_300, 7, 1);
    const s = scoreRun(scenario, events(o, [], o));
    expect(s).toMatchObject({ feasible: false, pickedOptimalSupplier: false, savedCents: 0, marginCaptured: 0 });
  });

  it('una corrida sin recomendación cuenta como incompleta', () => {
    const s = scoreRun(scenario, [{ type: 'error', message: 'no_offers' }]);
    expect(s).toMatchObject({ completed: false, feasible: false, pickedOptimalSupplier: false });
  });
});

describe('summarize', () => {
  it('promedia sobre todas las corridas', () => {
    const o = offer('envases-sur', 23_500, 5, 2);
    const good = scoreRun(scenario, events(o, [], offer('envases-sur', 24_500, 5, 1)));
    const bad = scoreRun(scenario, [{ type: 'error', message: 'no_offers' }]);
    expect(summarize([good, bad])).toMatchObject({ runs: 2, completedRate: 0.5, feasibleRate: 0.5, optimalSupplierRate: 0.5 });
  });
});
