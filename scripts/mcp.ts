// Servidor MCP (stdio) que expone a Regateo como herramientas para Claude u otro cliente MCP.
// Uso local: npm run mcp
// En Claude Code: claude mcp add regateo -- npm --prefix /ruta/a/regateo run --silent mcp
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runAgent } from '../src/core/agent';
import { scoreRun } from '../src/core/evals';
import type { RunEvent } from '../src/core/events';
import { GeminiLLM, modelChain } from '../src/core/gemini';
import { evaluateOffer } from '../src/core/policy';
import { getScenario, scenarios } from '../src/core/scenarios';

const server = new McpServer({ name: 'regateo', version: '0.1.0' });
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const policyShape = {
  maxTotalCents: z.number().int().min(1).describe('Presupuesto total en centavos de peso'),
  autoApproveUpToCents: z.number().int().min(0).describe('Hasta cuánto compra el agente sin pedir aprobación, en centavos'),
  maxDeliveryDays: z.number().int().min(1).max(60).describe('Plazo máximo de entrega en días'),
  blockedSupplierIds: z.array(z.string()).describe('Proveedores que el dueño no permite'),
};

server.registerTool(
  'list_scenarios',
  {
    title: 'Listar escenarios',
    description: 'Lista los escenarios de compra de ejemplo con su pedido, sus reglas por defecto y sus proveedores (datos ficticios).',
    annotations: { readOnlyHint: true },
  },
  async () =>
    text(scenarios.map((s) => ({ id: s.id, title: s.title.es, request: s.request, defaultPolicy: s.policy, suppliers: s.suppliers.map(({ id, name }) => ({ id, name })) }))),
);

server.registerTool(
  'check_offer',
  {
    title: 'Evaluar una oferta contra las reglas',
    description: 'Aplica las reglas del dueño a una oferta, con el mismo código determinista que usa el servidor. No llama a ningún modelo.',
    inputSchema: {
      supplierId: z.string(),
      unitPriceCents: z.number().int().positive(),
      deliveryDays: z.number().int().positive(),
      quantity: z.number().int().positive(),
      ...policyShape,
    },
    annotations: { readOnlyHint: true },
  },
  async ({ supplierId, unitPriceCents, deliveryDays, quantity, ...policy }) =>
    text(evaluateOffer({ supplierId, unitPriceCents, deliveryDays, round: 1 }, quantity, policy)),
);

server.registerTool(
  'negotiate',
  {
    title: 'Negociar una compra',
    description: 'Corre el agente completo sobre un escenario: pide cotizaciones, negocia, recomienda y devuelve el veredicto del servidor. Usa la capa gratuita de Gemini y tarda entre 20 y 60 segundos.',
    inputSchema: {
      scenarioId: z.string().describe('Un id de list_scenarios'),
      lang: z.enum(['es', 'en']).default('es'),
      policy: z.object(policyShape).optional().describe('Reglas a usar; si se omite, las del escenario'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ scenarioId, lang, policy }) => {
    const base = getScenario(scenarioId);
    if (!base) return { ...text({ error: 'unknown_scenario' }), isError: true };
    const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
    if (!GEMINI_API_KEY) return { ...text({ error: 'Falta GEMINI_API_KEY' }), isError: true };
    const scenario = { ...base, policy: policy ?? base.policy };
    const llm = new GeminiLLM(GEMINI_API_KEY, modelChain(GEMINI_MODEL));
    const events: RunEvent[] = [];
    const result = await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, (e) => events.push(e), lang);
    const recommendation = events.find((e) => e.type === 'recommendation');
    const verdict = events.find((e) => e.type === 'policy_result');
    const transcript = events.flatMap((e) =>
      e.type === 'agent_message' ? [`agente → ${e.supplierId}: ${e.text}`] : e.type === 'supplier_message' ? [`${e.supplierId}: ${e.text}`] : [],
    );
    return text({ result, recommendation, verdict: verdict?.result, score: scoreRun(scenario, events), transcript });
  },
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
