import { runAgent } from '../src/core/agent';
import type { RunEvent } from '../src/core/events';
import { GeminiLLM, modelChain } from '../src/core/gemini';
import { getScenario, scenarios } from '../src/core/scenarios';

const pesos = (cents: number) => `$${(cents / 100).toLocaleString('es-AR')}`;

function print(e: RunEvent) {
  switch (e.type) {
    case 'run_started':
      return console.log(`\nPedido: ${e.request.quantity} x ${e.request.product} · máximo ${pesos(e.policy.maxTotalCents)}\n`);
    case 'agent_message':
      return console.log(`[agente → ${e.supplierId}] (${e.tool}, ronda ${e.round}) ${e.text}`);
    case 'supplier_message':
      return console.log(`[${e.supplierId}] ${e.text}  → ${pesos(e.offer.unitPriceCents)} c/u, ${e.offer.deliveryDays} días`);
    case 'round_discarded':
      return console.log(`[descartado] ${e.supplierId}: ${e.reason}`);
    case 'ranking':
      console.log('\nRanking:');
      return e.rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.offer.supplierId} · ${pesos(r.totalCents)} · ${r.offer.deliveryDays} días · ${r.decision}`));
    case 'recommendation':
      return console.log(`\nRecomienda: ${e.supplierId}${e.forced ? ' (forzada)' : ''}\n${e.explanation}`);
    case 'policy_result':
      return console.log(`\nDecisión del servidor: ${e.result.decision} (${pesos(e.result.totalCents)})`);
    case 'llm_call':
      return;
    case 'manipulation_flagged':
      return console.log(`[⚠ manipulación] ${e.supplierId}: ${e.kinds.join(', ')}`);
    case 'error':
      return console.log(`[error] ${e.message}`);
  }
}

async function main() {
  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY en .env.local');
  const scenario = getScenario(process.argv[2] ?? scenarios[0].id);
  if (!scenario) throw new Error(`Escenario desconocido. Opciones: ${scenarios.map((s) => s.id).join(', ')}`);
  const llm = new GeminiLLM(GEMINI_API_KEY, modelChain(GEMINI_MODEL));
  const result = await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, print);
  console.log('\nResultado:', result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
