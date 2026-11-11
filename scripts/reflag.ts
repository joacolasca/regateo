// Recalcula las marcas del detector de manipulación sobre las corridas grabadas, con el detector actual.
// Solo cambia los eventos manipulation_flagged; los mensajes, ofertas y decisiones quedan como se grabaron.
// Uso: npx tsx scripts/reflag.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunEvent } from '../src/core/events';
import { detectManipulation } from '../src/core/guard';

const DIR = 'public/recordings';

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const path = join(DIR, file);
  const run = JSON.parse(readFileSync(path, 'utf8')) as { events: RunEvent[]; flagsRecomputedAt?: string; flagsNote?: string };
  const before = run.events.filter((e) => e.type === 'manipulation_flagged').length;
  const events: RunEvent[] = [];
  for (const e of run.events) {
    if (e.type === 'manipulation_flagged') continue;
    events.push(e);
    if (e.type !== 'supplier_message') continue;
    const kinds = detectManipulation(e.text);
    if (kinds.length) events.push({ type: 'manipulation_flagged', supplierId: e.supplierId, kinds });
  }
  const after = events.filter((e) => e.type === 'manipulation_flagged').length;
  if (after === before && JSON.stringify(events) === JSON.stringify(run.events)) continue;
  run.events = events;
  run.flagsRecomputedAt = new Date().toISOString();
  run.flagsNote = 'Las marcas del detector se recalcularon después de grabar; durante esta corrida el agente no vio esas advertencias.';
  writeFileSync(path, JSON.stringify(run, null, 2));
  console.log(`${file}: ${before} → ${after} marcas`);
}
