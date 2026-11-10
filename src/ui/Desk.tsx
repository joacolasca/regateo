'use client';

import { useEffect, useState } from 'react';
import { MAX_ROUNDS } from '../core/agent';
import { evaluateOffer, type PolicyCheck, type Rule } from '../core/policy';
import { featuredScenarios, getScenario } from '../core/scenarios';
import type { Lang, Policy } from '../core/types';
import type { DeskState, SupplierView } from './desk-state';
import { money } from './format';
import type { Dict } from './i18n';
import { useLang } from './lang';
import { useRun } from './useRun';

type Human = 'approved' | 'rejected' | null;

export function Desk() {
  const { lang, t } = useLang();
  const [scenarioId, setScenarioId] = useState(featuredScenarios[0].id);
  const scenario = getScenario(scenarioId) ?? featuredScenarios[0];
  const { desk, status, mode, fellBack, start } = useRun(scenario, lang);
  const [human, setHuman] = useState<Human>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const run = (requested: 'demo' | 'live') => {
    setHuman(null);
    setPicked(null);
    void start(requested);
  };

  // Al entrar, o al cambiar de escenario o idioma, la demo grabada arranca sola.
  useEffect(() => {
    const timer = setTimeout(() => {
      setHuman(null);
      setPicked(null);
      void start('demo');
    }, 500);
    return () => clearTimeout(timer);
  }, [start]);

  const running = status === 'running';
  const cleared = desk.verdict?.decision === 'auto' || human === 'approved';
  const stepIndex = cleared ? 4 : { idle: -1, quoting: 0, negotiating: 1, comparing: 2, decided: 3, failed: -1 }[desk.phase];
  const activeId = picked ?? desk.activeSupplierId;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-8 sm:py-10">
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">{t.tagline}</h1>
        <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{t.lede}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {featuredScenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              aria-pressed={s.id === scenario.id}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                s.id === scenario.id ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
              }`}
            >
              {s.title[lang]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => run('demo')}
            className="rounded-full bg-marker px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            ▶ {t.watchDemo}
          </button>
          <button
            type="button"
            onClick={() => run('live')}
            className="rounded-full border border-ink px-5 py-2 text-sm font-medium transition-colors hover:bg-ink hover:text-paper"
          >
            {t.runLive}
          </button>
          <span className="text-sm text-muted" aria-live="polite">
            {running ? `${t.running} ` : ''}
            {status !== 'ready' ? (mode === 'live' ? t.liveNow : t.replaying) : ''}
          </span>
        </div>
        {fellBack && <p className="mt-3 max-w-2xl rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{t.liveUnavailable}</p>}
      </section>

      {desk.request && desk.policy && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-line py-3">
            <span className="text-xs uppercase tracking-widest text-muted">{t.need}</span>
            <span className="font-display text-xl">
              {desk.request.quantity} × {desk.request.product}
            </span>
            <span className="text-muted">
              {t.inDays(desk.request.deadlineDays)} · {t.upTo} <span className="font-mono text-ink">{money(desk.policy.maxTotalCents, lang)}</span>
            </span>
            <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{t.sample}</span>
          </div>

          <ol className="my-5 flex flex-wrap gap-2 text-sm">
            {t.steps.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                  i < stepIndex ? 'border-ok/40 bg-ok/10 text-ok' : i === stepIndex ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
                }`}
              >
                <span className="font-mono text-xs">{i < stepIndex ? '✓' : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1.2fr_0.9fr]">
            <Conversations desk={desk} activeId={activeId} onPick={setPicked} t={t} />
            <Comparison desk={desk} policy={desk.policy} lang={lang} t={t} />
            <Rules desk={desk} policy={desk.policy} lang={lang} t={t} human={human} setHuman={setHuman} cleared={cleared} />
          </div>

          {desk.phase === 'failed' && <p className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-bad">{t.failed}</p>}

          {desk.recommendation && (
            <section className="rise mt-4 rounded-2xl border border-line bg-card p-5">
              <h2 className="text-xs uppercase tracking-widest text-muted">
                {t.recommendation} · {desk.suppliers.find((s) => s.id === desk.recommendation?.supplierId)?.name}
              </h2>
              <p className="mt-2 max-w-3xl font-display text-xl leading-snug sm:text-2xl">
                {desk.recommendation.forced ? t.forced : desk.recommendation.explanation}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Conversations({ desk, activeId, onPick, t }: { desk: DeskState; activeId?: string; onPick: (id: string) => void; t: Dict }) {
  const active = desk.suppliers.find((s) => s.id === activeId) ?? desk.suppliers[0];
  return (
    <Panel title={t.conversations}>
      <div className="mb-3 flex flex-wrap gap-1" role="tablist">
        {desk.suppliers.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === active?.id}
            onClick={() => onPick(s.id)}
            className={`rounded-full px-3 py-1 text-sm ${s.id === active?.id ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/5'}`}
          >
            {s.name}
            {s.bubbles.length > 0 && <span className="ml-1.5 font-mono text-xs opacity-60">{s.bubbles.filter((b) => b.kind === 'agent').length}</span>}
          </button>
        ))}
      </div>
      {active && <Thread supplier={active} t={t} />}
    </Panel>
  );
}

function Thread({ supplier, t }: { supplier: SupplierView; t: Dict }) {
  if (supplier.bubbles.length === 0) return <p className="py-6 text-sm text-muted">{t.noMessages}</p>;
  return (
    <div className="flex flex-col gap-2">
      {supplier.bubbles.map((b, i) => {
        if (b.kind === 'agent') {
          return (
            <div key={i} className="rise ml-6">
              <p className="mb-1 text-right font-mono text-[11px] text-muted">
                {t.agent} · {t.tool[b.tool]} · {t.round(b.round, MAX_ROUNDS)}
              </p>
              <p className="rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2.5 text-sm leading-relaxed text-paper">{b.text}</p>
            </div>
          );
        }
        if (b.kind === 'supplier') {
          return (
            <div key={i} className="rise mr-6">
              <p className="mb-1 font-mono text-[11px] text-muted">{supplier.name}</p>
              <p className="rounded-2xl rounded-tl-sm border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed">{b.text}</p>
            </div>
          );
        }
        return (
          <p key={i} className="rise rounded-lg border border-dashed border-warn/50 px-3 py-2 text-xs text-warn">
            {t.discarded[b.reason]}
          </p>
        );
      })}
      {supplier.awaitingReply && (
        <p className="mr-6 w-fit rounded-2xl border border-line bg-paper px-4 py-2 text-lg leading-none" aria-label="…">
          <span className="dot">•</span>
          <span className="dot">•</span>
          <span className="dot">•</span>
        </p>
      )}
    </div>
  );
}

function Comparison({ desk, policy, lang, t }: { desk: DeskState; policy: Policy; lang: Lang; t: Dict }) {
  const quantity = desk.request?.quantity ?? 0;
  const order = desk.ranking?.map((r) => r.offer.supplierId) ?? [];
  const suppliers = [...desk.suppliers].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <Panel title={t.comparison}>
      <div className="flex flex-col gap-2.5">
        {suppliers.map((s) => {
          const latest = s.offers.at(-1);
          const first = s.offers[0];
          const result = latest ? evaluateOffer(latest, quantity, policy) : null;
          const failing = result?.checks.find((c) => !c.passed && c.rule !== 'auto_limit');
          const recommended = desk.recommendation?.supplierId === s.id;
          const blocked = policy.blockedSupplierIds.includes(s.id);
          const saved = latest && first ? (first.unitPriceCents - latest.unitPriceCents) * quantity : 0;
          const prices = s.offers.map((o) => o.unitPriceCents).filter((p, i, all) => i === 0 || p !== all[i - 1]);

          return (
            <article
              key={s.id}
              className={`rounded-xl border p-3 transition-colors ${recommended ? 'border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)]' : 'border-line'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{s.name}</h3>
                {recommended && <span className="rounded-full bg-marker px-2.5 py-0.5 text-xs font-medium text-white">{t.recommended}</span>}
              </div>

              {!latest || !result ? (
                <p className="mt-1 text-sm text-muted">{blocked ? t.blocked : t.noOffer}</p>
              ) : (
                <>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 font-mono">
                    {prices.slice(0, -1).map((p, i) => (
                      <span key={i} className="struck text-sm">
                        {money(p, lang)}
                      </span>
                    ))}
                    <span className="rise text-xl font-medium" key={prices.at(-1)}>
                      {money(prices.at(-1) ?? 0, lang)}
                    </span>
                    <span className="font-sans text-xs text-muted">{t.perUnit}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm text-muted">
                    <span>{t.days(latest.deliveryDays)}</span>
                    <span className="font-mono text-ink">{money(result.totalCents, lang)}</span>
                  </div>
                  <p className={`mt-1.5 text-xs ${failing ? 'text-bad' : 'text-ok'}`}>
                    {failing ? `✕ ${t.status[failing.rule as Exclude<Rule, 'auto_limit'>]}` : `✓ ${t.status.ok}`}
                    {!failing && saved > 0 && <span className="text-muted"> · {t.saved(money(saved, lang))}</span>}
                  </p>
                </>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function Rules({
  desk, policy, lang, t, human, setHuman, cleared,
}: {
  desk: DeskState; policy: Policy; lang: Lang; t: Dict; human: Human; setHuman: (h: Human) => void; cleared: boolean;
}) {
  const labels: Record<Rule, string> = {
    budget: t.rule.budget(money(policy.maxTotalCents, lang)),
    delivery: t.rule.delivery(policy.maxDeliveryDays),
    supplier_allowed: t.rule.supplier_allowed,
    auto_limit: t.rule.auto_limit(money(policy.autoApproveUpToCents, lang)),
  };
  const checks = new Map<Rule, PolicyCheck>(desk.verdict?.checks.map((c) => [c.rule, c]));
  const decision = desk.verdict?.decision;
  const tone = { auto: 'border-ok/40 bg-ok/10 text-ok', needs_approval: 'border-warn/40 bg-warn/10 text-warn', rejected: 'border-bad/40 bg-bad/10 text-bad' };

  const download = async () => {
    const rec = desk.recommendation;
    const supplier = desk.suppliers.find((s) => s.id === rec?.supplierId);
    const offer = supplier?.offers.at(-1);
    if (!rec || !supplier || !offer || !desk.request || !desk.verdict) return;
    const { buildPurchaseOrder } = await import('../lib/po');
    const bytes = await buildPurchaseOrder({
      lang,
      orderNo: `RG-${Date.now().toString(36).toUpperCase()}`,
      date: new Date(),
      request: desk.request,
      supplierName: supplier.name,
      offer,
      totalCents: desk.verdict.totalCents,
      approval: human === 'approved' ? 'human' : 'auto',
      explanation: rec.forced ? t.forced : rec.explanation,
    });
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `regateo-${supplier.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title={t.rules}>
      <ul className="flex flex-col gap-2 text-sm">
        {(Object.keys(labels) as Rule[]).map((rule) => {
          const check = checks.get(rule);
          const mark = !check ? '·' : check.passed ? '✓' : rule === 'auto_limit' ? '!' : '✕';
          const color = !check ? 'text-muted' : check.passed ? 'text-ok' : rule === 'auto_limit' ? 'text-warn' : 'text-bad';
          return (
            <li key={rule} className="flex gap-2">
              <span className={`w-4 shrink-0 text-center font-mono ${color}`}>{mark}</span>
              <span>{labels[rule]}</span>
            </li>
          );
        })}
      </ul>

      {decision && (
        <div className="rise mt-4 flex flex-col gap-2.5">
          <p className={`rounded-lg border px-3 py-2 text-sm ${tone[decision]}`}>{t.verdict[decision]}</p>
          {decision === 'needs_approval' && human === null && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setHuman('approved')} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
                {t.approve}
              </button>
              <button type="button" onClick={() => setHuman('rejected')} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                {t.reject}
              </button>
            </div>
          )}
          {human === 'approved' && <p className="text-sm text-ok">✓ {t.approved}</p>}
          {human === 'rejected' && <p className="text-sm text-bad">✕ {t.rejectedByHuman}</p>}
          {cleared && (
            <button type="button" onClick={download} className="rounded-full border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
              ↓ {t.downloadPo}
            </button>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t.serverNote}</p>
    </Panel>
  );
}
