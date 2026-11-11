import { runAgent } from '@/core/agent';
import { scoreRun } from '@/core/evals';
import type { RunEvent } from '@/core/events';
import { prepareRun } from '@/lib/live';

export const maxDuration = 120;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * API pública: corre una negociación completa y devuelve el resultado en un solo JSON.
 * Pensada para llamarla desde n8n, Zapier o un script.
 */
export async function POST(req: Request) {
  const prepared = prepareRun(await req.json().catch(() => null), req, { patient: false });
  if (!prepared.ok) return Response.json({ error: prepared.error }, { status: prepared.status, headers: CORS });
  const { scenario, lang, llm } = prepared;

  const events: RunEvent[] = [];
  const startedAt = Date.now();
  const result = await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, (e) => events.push(e), lang);
  const score = scoreRun(scenario, events);
  const recommendation = events.find((e) => e.type === 'recommendation');
  const verdict = events.find((e) => e.type === 'policy_result');
  const ranking = events.find((e) => e.type === 'ranking');

  return Response.json(
    {
      status: result.status,
      scenarioId: scenario.id,
      policy: scenario.policy,
      recommendation: recommendation && {
        supplierId: recommendation.supplierId,
        supplierName: scenario.suppliers.find((s) => s.id === recommendation.supplierId)?.name,
        explanation: recommendation.explanation,
        forcedByServer: recommendation.forced,
      },
      decision: verdict?.result.decision ?? null,
      totalCents: verdict?.result.totalCents ?? null,
      checks: verdict?.result.checks ?? [],
      ranking: ranking?.rows.map((r) => ({ ...r.offer, totalCents: r.totalCents, decision: r.decision })) ?? [],
      manipulationFlags: events.flatMap((e) => (e.type === 'manipulation_flagged' ? [{ supplierId: e.supplierId, kinds: e.kinds }] : [])),
      usage: {
        llmCalls: score.llmCalls,
        inputTokens: score.inputTokens,
        outputTokens: score.outputTokens,
        modelMs: score.llmMs,
        wallMs: Date.now() - startedAt,
        costUsd: 0,
      },
      events,
    },
    { headers: { ...CORS, 'Cache-Control': 'no-store' } },
  );
}
