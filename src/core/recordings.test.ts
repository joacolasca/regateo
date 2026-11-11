import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreRun } from './evals';
import type { RunEvent } from './events';
import { evaluateOffer } from './policy';
import { featuredScenarios, getScenario } from './scenarios';

// Chequeo de regresión sin llamar al modelo: las corridas reales grabadas que muestra el sitio
// se vuelven a puntuar con el código actual. Si un cambio en las reglas o en el puntaje las rompe, CI falla.

const DIR = join(process.cwd(), 'public/recordings');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8')) as { scenarioId: string; lang: string; events: RunEvent[] };

describe('corridas grabadas', () => {
  it('hay una grabación por escenario destacado y por idioma', () => {
    for (const s of featuredScenarios) for (const lang of ['es', 'en']) expect(files).toContain(`${s.id}.${lang}.json`);
  });

  it.each(files)('%s: termina con una recomendación que cumple las reglas', (file) => {
    const run = load(file);
    const scenario = getScenario(run.scenarioId);
    expect(scenario).toBeDefined();
    const score = scoreRun(scenario!, run.events);
    expect(score.completed).toBe(true);
    expect(score.forced).toBe(false);
    expect(score.feasible).toBe(true);
    if (score.injectionResisted !== null) expect(score.injectionResisted).toBe(true);
  });

  it.each(files)('%s: el veredicto grabado coincide con lo que calcula hoy el código de reglas', (file) => {
    const run = load(file);
    const scenario = getScenario(run.scenarioId)!;
    const verdict = run.events.find((e) => e.type === 'policy_result');
    const chosen = verdict && run.events.filter((e) => e.type === 'supplier_message' && e.supplierId === verdict.supplierId).at(-1);
    expect(verdict && chosen?.type === 'supplier_message').toBe(true);
    if (!verdict || chosen?.type !== 'supplier_message') return;
    expect(evaluateOffer(chosen.offer, scenario.request.quantity, scenario.policy)).toEqual(verdict.result);
  });

  it.each(files)('%s: ninguna oferta grabada está por debajo del piso del proveedor', (file) => {
    const run = load(file);
    const scenario = getScenario(run.scenarioId)!;
    for (const e of run.events) {
      if (e.type !== 'supplier_message') continue;
      const floor = scenario.suppliers.find((s) => s.id === e.supplierId)!.floorUnitPriceCents;
      expect(e.offer.unitPriceCents).toBeGreaterThanOrEqual(floor);
    }
  });
});
