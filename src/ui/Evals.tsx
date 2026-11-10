'use client';

import type { EvalSummary } from '../core/evals';
import { getScenario } from '../core/scenarios';
import { percent } from './format';
import { useLang } from './lang';

export interface EvalFile {
  summary: EvalSummary | null;
  model?: string;
  ranAt?: string;
  byScenario?: { scenarioId: string; summary: EvalSummary }[];
}

export function Evals({ data }: { data: EvalFile }) {
  const { lang, t } = useLang();
  const e = t.evals;
  const s = data.summary;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{e.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{e.lede}</p>

      {!s || s.runs === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-card p-5 text-muted">{e.empty}</p>
      ) : (
        <>
          <p className="mt-3 font-mono text-xs text-muted">
            {e.meta(s.runs, data.model ?? '', data.ranAt ? new Date(data.ranAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) : '')}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [e.feasible, percent(s.feasibleRate)],
              [e.optimal, percent(s.optimalSupplierRate)],
              [e.margin, percent(s.avgMarginCaptured)],
              [e.forced, percent(s.forcedRate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-card p-5">
                <p className="font-display text-5xl tracking-tight">{value}</p>
                <p className="mt-2 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted">
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
                    <td className="px-4 py-3">{percent(row.summary.feasibleRate)}</td>
                    <td className="px-4 py-3">{percent(row.summary.optimalSupplierRate)}</td>
                    <td className="px-4 py-3">{percent(row.summary.avgMarginCaptured)}</td>
                    <td className="px-4 py-3">{row.summary.avgAgentMessages.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-10 text-xs uppercase tracking-widest text-muted">{e.how}</h2>
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
