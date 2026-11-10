'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunEvent } from '../core/events';
import type { Lang, Scenario } from '../core/types';
import { applyEvent, emptyDesk, startEvent, type DeskState } from './desk-state';

export type Mode = 'demo' | 'live';
export type RunStatus = 'ready' | 'running' | 'done';

const PAUSE: Record<RunEvent['type'], number> = {
  run_started: 0, agent_message: 1100, supplier_message: 1500, round_discarded: 700,
  ranking: 1000, recommendation: 900, policy_result: 800, error: 300,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadRecording(scenarioId: string, lang: Lang): Promise<RunEvent[]> {
  const res = await fetch(`/recordings/${scenarioId}.${lang}.json`);
  if (!res.ok) throw new Error('recording_missing');
  return (await res.json()).events as RunEvent[];
}

async function* readLive(scenarioId: string, lang: Lang, signal: AbortSignal): AsyncGenerator<RunEvent> {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId, lang }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error('live_unavailable');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as RunEvent;
  }
}

export function useRun(scenario: Scenario, lang: Lang) {
  const [desk, setDesk] = useState<DeskState>(() => applyEvent(emptyDesk, startEvent(scenario, lang)));
  const [status, setStatus] = useState<RunStatus>('ready');
  const [mode, setMode] = useState<Mode>('demo');
  const [fellBack, setFellBack] = useState(false);
  const runId = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    runId.current += 1;
    abort.current?.abort();
    setDesk(applyEvent(emptyDesk, startEvent(scenario, lang)));
    setStatus('ready');
    setFellBack(false);
  }, [scenario, lang]);

  // Cambiar de escenario o de idioma vuelve la mesa al estado inicial.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio deliberado al cambiar las entradas
  useEffect(reset, [reset]);

  const playRecording = useCallback(async (id: number) => {
    const events = await loadRecording(scenario.id, lang);
    for (const event of events) {
      if (event.type === 'run_started') continue;
      await sleep(PAUSE[event.type]);
      if (runId.current !== id) return;
      setDesk((d) => applyEvent(d, event));
    }
  }, [scenario, lang]);

  const start = useCallback(async (requested: Mode) => {
    const id = ++runId.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setDesk(applyEvent(emptyDesk, startEvent(scenario, lang)));
    setStatus('running');
    setMode(requested);
    setFellBack(false);

    const fallback = async () => {
      setDesk(applyEvent(emptyDesk, startEvent(scenario, lang)));
      setMode('demo');
      setFellBack(true);
      await playRecording(id);
    };

    try {
      if (requested === 'demo') {
        await playRecording(id);
      } else {
        let offers = 0;
        let failed = false;
        try {
          for await (const event of readLive(scenario.id, lang, controller.signal)) {
            if (runId.current !== id) return;
            if (event.type === 'run_started') continue;
            if (event.type === 'supplier_message') offers += 1;
            // Si el modelo se cae antes de conseguir una sola oferta, no hay nada que mostrar.
            if (event.type === 'error' && offers === 0) {
              failed = true;
              break;
            }
            setDesk((d) => applyEvent(d, event));
          }
        } catch {
          failed = true;
        }
        if (runId.current !== id) return;
        if (failed) await fallback();
      }
    } catch {
      // Sin grabación disponible la mesa queda en su estado inicial.
    }
    if (runId.current === id) setStatus('done');
  }, [scenario, lang, playRecording]);

  return { desk, status, mode, fellBack, start };
}
