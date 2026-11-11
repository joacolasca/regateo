// Corre cada escenario N veces con el LLM real y guarda los resultados que muestra /evals.
// Uso: npm run evals            (3 corridas por escenario)
//      npm run evals -- 5
import { mkdirSync, writeFileSync } from 'node:fs';
import { runAgent } from '../src/core/agent';
import { scoreRun, summarize, type RunScore } from '../src/core/evals';
import type { RunEvent } from '../src/core/events';
import { GeminiLLM, modelChain } from '../src/core/gemini';
import { scenarios } from '../src/core/scenarios';

async function main() {
  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY en .env.local');
  const runsPerScenario = Number(process.argv[2] ?? 3);
  const llm = new GeminiLLM(GEMINI_API_KEY, modelChain(GEMINI_MODEL));
  const scores: RunScore[] = [];

  const save = () => {
    mkdirSync('src/data', { recursive: true });
    writeFileSync('src/data/evals.json', JSON.stringify({
      model: llm.model,
      ranAt: new Date().toISOString(),
      runsPerScenario,
      summary: summarize(scores),
      byScenario: scenarios
        .map((s) => ({ scenarioId: s.id, summary: summarize(scores.filter((x) => x.scenarioId === s.id)) }))
        .filter((row) => row.summary.runs > 0),
      scores,
    }, null, 2));
  };

  for (const scenario of scenarios) {
    for (let i = 1; i <= runsPerScenario; i++) {
      const events: RunEvent[] = [];
      await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, (e) => events.push(e));
      const score = scoreRun(scenario, events);
      scores.push(score);
      save();
      console.log(`${scenario.id} #${i}: factible=${score.feasible} óptimo=${score.pickedOptimalSupplier} margen=${score.marginCaptured.toFixed(2)} forzada=${score.forced}`);
    }
  }
  console.log('\nResumen:', summarize(scores));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
