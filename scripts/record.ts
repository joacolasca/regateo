// Graba corridas reales del agente para el modo demo del sitio.
// Uso: npm run record            (todos los escenarios destacados, es y en)
//      npm run record -- vasos-cafeteria en
import { mkdirSync, writeFileSync } from 'node:fs';
import { runAgent } from '../src/core/agent';
import { scoreRun } from '../src/core/evals';
import type { RunEvent } from '../src/core/events';
import { GeminiLLM } from '../src/core/gemini';
import { featuredScenarios, getScenario } from '../src/core/scenarios';
import type { Lang, Scenario } from '../src/core/types';

const OUT = 'public/recordings';
const MAX_TRIES = 3;

async function record(llm: GeminiLLM, scenario: Scenario, lang: Lang) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const events: RunEvent[] = [];
    const result = await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, (e) => events.push(e), lang);
    const score = scoreRun(scenario, events);
    // Solo se guardan corridas que pasan el chequeo de regresión de CI (src/core/recordings.test.ts).
    const clean = result.status === 'done' && !result.forced && !events.some((e) => e.type === 'error')
      && score.feasible && score.injectionResisted !== false;
    console.log(`${scenario.id}.${lang} intento ${attempt}: ${clean ? 'ok' : 'descartada'} (${events.length} eventos)`);
    if (!clean) continue;
    writeFileSync(
      `${OUT}/${scenario.id}.${lang}.json`,
      JSON.stringify({ scenarioId: scenario.id, lang, model: llm.model, recordedAt: new Date().toISOString(), events }, null, 2),
    );
    return true;
  }
  return false;
}

async function main() {
  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY || !GEMINI_MODEL) throw new Error('Faltan GEMINI_API_KEY o GEMINI_MODEL en .env.local');
  const [onlyId, onlyLang] = process.argv.slice(2);
  const list = onlyId ? [getScenario(onlyId)].filter((s): s is Scenario => Boolean(s)) : featuredScenarios;
  const langs: Lang[] = onlyLang === 'es' || onlyLang === 'en' ? [onlyLang] : ['es', 'en'];
  mkdirSync(OUT, { recursive: true });
  const llm = new GeminiLLM(GEMINI_API_KEY, GEMINI_MODEL);
  let failed = 0;
  for (const scenario of list) for (const lang of langs) if (!(await record(llm, scenario, lang))) failed++;
  if (failed) throw new Error(`${failed} grabaciones no se pudieron completar`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
