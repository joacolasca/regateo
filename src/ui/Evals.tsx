'use client';

import type { EvalSummary } from '../core/evals';
import { getScenario } from '../core/scenarios';
import { percent } from './format';
import { InkBand } from './InkBand';
import { useLang } from './lang';

export interface EvalFile {
  summary: EvalSummary | null;
  model?: string;
  ranAt?: string;
  byScenario?: { scenarioId: string; summary: EvalSummary }[];
}

const dateOf = (iso: string | undefined, lang: string) =>
  iso ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

/** Barra horizontal 0–100% con la línea base marcada. */
function Meter({ value, baseline }: { value: number; baseline?: number }) {
  return (
    <div className="relative mt-3 h-2 rounded-full bg-line" aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full bg-marker" style={{ width: `${value * 100}%` }} />
      {baseline !== undefined && <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${baseline * 100}%` }} />}
    </div>
  );
}

export function Evals({ data, baseline }: { data: EvalFile; baseline?: EvalFile }) {
  const { lang, t } = useLang();
  const e = t.evals;
  const s = data.summary;
  const b = baseline?.summary ?? undefined;

  const cards: [string, number, number | undefined][] = s
    ? [
        [e.feasible, s.feasibleRate, b?.feasibleRate],
        [e.optimal, s.optimalSupplierRate, b?.optimalSupplierRate],
        [e.margin, s.avgMarginCaptured, b?.avgMarginCaptured],
        [e.injection, s.injectionResistedRate ?? 0, undefined],
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <InkBand shape="swirl" />
      <h1 className="mt-8 font-display text-5xl tracking-tight sm:text-6xl">{e.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{e.lede}</p>

      {!s || s.runs === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-card p-5 text-muted">{e.empty}</p>
      ) : (
        <>
          <p className="mt-3 font-mono text-xs text-muted">{e.meta(s.runs, data.model ?? '', dateOf(data.ranAt, lang))}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value, base]) => (
              <div key={label} className="rounded-2xl border border-line bg-card p-5">
                <p className="font-display text-5xl tracking-tight">{percent(value)}</p>
                <p className="mt-2 text-sm text-muted">{label}</p>
                <Meter value={value} baseline={base} />
                {base !== undefined && (
                  <p className="mt-2 font-mono text-[11px] text-muted">
                    {e.baselineShort(percent(base))}
                  </p>
                )}
                {label === e.injection && <p className="mt-2 font-mono text-[11px] text-muted">{e.injectionRuns(s.injectionRuns ?? 0)}</p>}
              </div>
            ))}
          </div>

          {b && baseline && s.feasibleRate > b.feasibleRate && (
            <section className="mt-6 rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
              <h2 className="font-mono text-xs uppercase tracking-widest text-marker">{e.storyTitle}</h2>
              <p className="mt-2 max-w-3xl font-display text-xl leading-snug sm:text-2xl">
                {e.story(percent(b.feasibleRate), percent(s.feasibleRate))}
              </p>
              <p className="mt-2 max-w-3xl text-sm text-muted">{e.storyNote(b.runs, s.runs)}</p>
            </section>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              [e.calls, s.avgLlmCalls ? s.avgLlmCalls.toFixed(1) : '—'],
              [e.tokens, s.avgTokens ? Math.round(s.avgTokens).toLocaleString(lang === 'en' ? 'en-US' : 'es-AR') : '—'],
              [e.latency, s.avgLlmCallMs ? `${(s.avgLlmCallMs / 1000).toFixed(1)} s` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4">
                <span className="text-sm text-muted">{label}</span>
                <span className="font-mono text-xl">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="font-mono text-xs uppercase tracking-widest text-muted">
                <tr>
                  {[e.scenario, e.runs, e.feasible, e.optimal, e.margin, e.messages].map((h) => (
                    <th key={h} className="px-4 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {data.byScenario?.map((row) => (
                  <tr key={row.scenarioId} className="border-t border-line">
                    <td className="px-4 py-3 font-sans">{getScenario(row.scenarioId)?.title[lang] ?? row.scenarioId}</td>
                    <td className="px-4 py-3">{row.summary.runs}</td>
                    <td className={`px-4 py-3 ${row.summary.feasibleRate < 1 ? 'text-bad' : ''}`}>{percent(row.summary.feasibleRate)}</td>
                    <td className="px-4 py-3">{percent(row.summary.optimalSupplierRate)}</td>
                    <td className="px-4 py-3">{percent(row.summary.avgMarginCaptured)}</td>
                    <td className="px-4 py-3">{row.summary.avgAgentMessages.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">{e.honest}</p>
        </>
      )}

      <h2 className="mt-10 font-mono text-xs uppercase tracking-widest text-muted">{e.how}</h2>
      <ul className="mt-3 flex max-w-3xl flex-col gap-2 text-sm text-muted">
        {e.howItems.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-marker">—</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
