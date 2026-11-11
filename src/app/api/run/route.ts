import { runAgent } from '@/core/agent';
import type { RunEvent } from '@/core/events';
import { prepareRun } from '@/lib/live';

export const maxDuration = 120;

/** Corrida en vivo para la página: transmite cada evento del agente como una línea JSON (NDJSON). */
export async function POST(req: Request) {
  // En vivo no se espera ante un límite por minuto: se corta y la página vuelve a la grabación.
  const prepared = prepareRun(await req.json().catch(() => null), req, { patient: false });
  if (!prepared.ok) return Response.json({ error: prepared.error }, { status: prepared.status });
  const { scenario, lang, llm } = prepared;

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
        await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, emit, lang);
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
