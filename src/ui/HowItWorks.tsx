'use client';

import { REPO_URL } from './Header';
import { InkBand } from './InkBand';
import { useLang } from './lang';

const SITE = 'https://regateo.vercel.app';

export function HowItWorks() {
  const { lang, t } = useLang();
  const h = t.how;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <InkBand shape="ripple" />
      <h1 className="mt-8 font-display text-5xl tracking-tight sm:text-6xl">{h.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{h.lede}</p>

      <ol className="mt-8 flex flex-wrap items-center gap-y-3 text-sm">
        {h.flow.map((step, i) => (
          <li key={step} className="flex items-center">
            <span
              className={`rounded-full border px-3.5 py-1.5 ${
                i === 1 || i === 2 ? 'border-marker text-marker' : i === 3 || i === 4 ? 'border-ink bg-ink text-paper' : 'border-line'
              }`}
            >
              {step}
            </span>
            {i < h.flow.length - 1 && <span className="px-2 text-muted">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><span className="text-marker">●</span> LLM</span>
        <span>● {t.serverNote}</span>
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {h.points.map(([title, body], i) => (
          <article key={title} className="rounded-2xl border border-line bg-card p-5">
            <p className="font-mono text-xs text-marker">0{i + 1}</p>
            <h2 className="mt-2 font-display text-xl leading-tight">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight">{h.integrate}</h2>
        <p className="mt-2 text-muted">{h.integrateLede}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="min-w-0 rounded-2xl border border-line bg-card p-5">
            <h3 className="font-mono text-xs uppercase tracking-widest text-marker">{h.api}</h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-paper">{`curl -X POST ${SITE}/api/v1/negotiate \\
  -H 'Content-Type: application/json' \\
  -d '{"scenarioId":"cajas-pizzeria","lang":"${lang}"}'

curl ${SITE}/api/v1/scenarios`}</pre>
            <p className="mt-3 text-sm text-muted">{h.apiNote}</p>
          </article>
          <article className="min-w-0 rounded-2xl border border-line bg-card p-5">
            <h3 className="font-mono text-xs uppercase tracking-widest text-marker">{h.mcp}</h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-paper">{`git clone ${REPO_URL}
cd regateo && npm install
cp .env.example .env.local   # GEMINI_API_KEY

claude mcp add regateo -- \\
  npm --prefix "$PWD" run --silent mcp`}</pre>
            <p className="mt-3 text-sm text-muted">{h.mcpNote}</p>
          </article>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted">
        {h.stack}{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
          {t.nav.repo} ↗
        </a>
      </p>
    </div>
  );
}
