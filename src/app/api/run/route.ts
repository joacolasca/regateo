import { z } from 'zod';
import { runAgent } from '@/core/agent';
import type { RunEvent } from '@/core/events';
import { GeminiLLM } from '@/core/gemini';
import { getScenario } from '@/core/scenarios';
import { Throttle } from '@/lib/throttle';

export const maxDuration = 120;

const Body = z.object({ scenarioId: z.string(), lang: z.enum(['es', 'en']) });

const throttle = new Throttle({
  perKey: 3, perKeyWindowMs: 10 * 60_000,
  global: 40, globalWindowMs: 24 * 60 * 60_000,
});

const unavailable = (status: number) => Response.json({ error: 'live_unavailable' }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const scenario = parsed.success ? getScenario(parsed.data.scenarioId) : undefined;
  if (!parsed.success || !scenario) return Response.json({ error: 'bad_request' }, { status: 400 });

  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY || !GEMINI_MODEL) return unavailable(503);

  const visitor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!throttle.allow(visitor)) return unavailable(429);

  // En vivo no se espera ante un límite del modelo: se corta y el cliente vuelve a la grabación.
  const llm = new GeminiLLM(GEMINI_API_KEY, GEMINI_MODEL, { patient: false });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // El visitante cerró la pestaña: la corrida termina sola por el límite de pasos.
        }
      };
      try {
        await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, emit, parsed.data.lang);
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
