'use client';

import { useEffect, useState } from 'react';
import { MAX_ROUNDS } from '../core/agent';
import { evaluateOffer, type Decision, type PolicyCheck, type Rule } from '../core/policy';
import { featuredScenarios, getScenario } from '../core/scenarios';
import type { Lang, Policy, Scenario } from '../core/types';
import { deriveView, type DeskState, type DeskView, type SupplierView } from './desk-state';
import { money, percent } from './format';
import { HeroArt } from './HeroArt';
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
  const [edits, setEdits] = useState<Policy | null>(null);

  const policy = edits ?? desk.policy;
  const view = deriveView(desk, policy);
  const running = status === 'running';

  const run = (requested: 'demo' | 'live') => {
    setHuman(null);
    setPicked(null);
    setEdits(null);
    void start(requested, requested === 'live' ? policy : undefined);
  };

  const editPolicy = (next: Policy | null) => {
    setHuman(null);
    setEdits(next);
  };

  // Al entrar, o al cambiar de escenario o idioma, la demo grabada arranca sola.
  useEffect(() => {
    const timer = setTimeout(() => {
      setHuman(null);
      setPicked(null);
      setEdits(null);
      void start('demo');
    }, 500);
    return () => clearTimeout(timer);
  }, [start]);

  const cleared = view.verdict?.decision === 'auto' || human === 'approved';
  const stepIndex = cleared ? 4 : { idle: -1, quoting: 0, negotiating: 1, comparing: 2, decided: 3, failed: -1 }[desk.phase];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <RoughInk />
      <section className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h1 className="font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">{t.tagline}</h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{t.lede}</p>

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
              className="press rounded-full border-2 border-ink bg-marker px-5 py-2 text-sm font-medium text-white"
            >
              ▶ {t.watchDemo}
            </button>
            <button type="button" onClick={() => run('live')} className="press rounded-full border-2 border-ink bg-card px-5 py-2 text-sm font-medium">
              {edits ? t.edit.runLive : t.runLive}
            </button>
            <span className="text-sm text-muted" aria-live="polite">
              {running ? `${t.running} ` : ''}
              {status !== 'ready' ? (mode === 'live' ? t.liveNow : t.replaying) : ''}
            </span>
          </div>
          {fellBack && <p className="mt-3 max-w-xl rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{t.liveUnavailable}</p>}
        </div>

        <HeroArt desk={desk} policy={policy} lang={lang} t={t} />
      </section>

      {desk.request && policy && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y-2 border-ink py-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">{t.need}</span>
            <span className="font-display text-xl sm:text-2xl">
              {desk.request.quantity} × {desk.request.product}
            </span>
            <span className="text-muted">
              {t.inDays(policy.maxDeliveryDays)} · {t.upTo} <span className="font-mono text-ink">{money(policy.maxTotalCents, lang)}</span>
            </span>
            <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{t.sample}</span>
          </div>

          <ol className="my-5 flex flex-wrap gap-2 text-sm">
            {t.steps.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${
                  i < stepIndex ? 'border-ok/40 bg-ok/10 text-ok' : i === stepIndex ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
                }`}
              >
                <span className="font-mono text-xs">{i < stepIndex ? '✓' : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1.2fr_0.9fr]">
            <Conversations desk={desk} activeId={picked ?? desk.activeSupplierId} onPick={setPicked} t={t} />
            <Comparison desk={desk} view={view} scenario={scenario} policy={policy} lang={lang} t={t} />
            <Rules
              desk={desk} view={view} scenario={scenario} policy={policy} lang={lang} t={t}
              human={human} setHuman={setHuman} cleared={cleared} edited={edits !== null}
              onEdit={editPolicy} locked={running}
            />
          </div>

          {desk.phase === 'failed' && <p className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-bad">{t.failed}</p>}

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.9fr_1.1fr]">
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
                {t.recommendation}
                {view.recommendedId && ` · ${desk.suppliers.find((s) => s.id === view.recommendedId)?.name}`}
              </h2>
              {view.whatIf ? (
                <p className="rise mt-2 max-w-3xl font-display text-xl leading-snug sm:text-2xl">{t.edit.whatIf}</p>
              ) : desk.recommendation ? (
                <p className="rise mt-2 max-w-3xl font-display text-xl leading-snug sm:text-2xl">
                  {desk.recommendation.forced ? t.forced : desk.recommendation.explanation}
                </p>
              ) : (
                <p className="mt-2 text-muted">…</p>
              )}
            </section>
            <div className="flex flex-col gap-3">
              <Receipt desk={desk} t={t} />
              {desk.phase === 'decided' && (
                <button type="button" onClick={() => downloadAudit(desk, scenario, policy, lang)} className="rounded-full border border-line px-4 py-2 text-xs hover:border-ink">
                  ↓ {t.audit}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function downloadAudit(desk: DeskState, scenario: Scenario, policy: Policy | undefined, lang: Lang) {
  const body = {
    app: 'regateo',
    exportedAt: new Date().toISOString(),
    scenarioId: scenario.id,
    lang,
    policyApplied: policy,
    note: 'Datos de ejemplo. Cada evento es lo que emitió el agente o el servidor, en orden.',
    events: desk.log,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `regateo-audit-${scenario.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Filtro SVG que le da borde irregular de tinta a los sellos. */
function RoughInk() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="rough-ink">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
      </filter>
    </svg>
  );
}

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">{title}</h2>
        {aside}
      </div>
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
            {s.flagged.length > 0 && <span className="mr-1 text-bad" aria-label={t.manipulation.badge}>⚠</span>}
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
          const flagged = b.flagged && b.flagged.length > 0;
          return (
            <div key={i} className="rise mr-6">
              <p className="mb-1 font-mono text-[11px] text-muted">{supplier.name}</p>
              <p className={`rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-relaxed ${flagged ? 'hazard border-bad' : 'border-line bg-paper'}`}>
                {b.text}
              </p>
              {flagged && (
                <p className="mt-1 rounded-lg bg-bad/10 px-2.5 py-1.5 text-[11px] leading-snug text-bad">
                  ⚠ {t.manipulation.bubble} <span className="font-mono">({b.flagged!.map((k) => t.manipulation.kinds[k] ?? k).join(' · ')})</span>
                </p>
              )}
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

function Comparison({
  desk, view, scenario, policy, lang, t,
}: {
  desk: DeskState; view: DeskView; scenario: Scenario; policy: Policy; lang: Lang; t: Dict;
}) {
  const quantity = desk.request?.quantity ?? 0;
  const order = view.ranking?.map((r) => r.offer.supplierId) ?? [];
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
          const recommended = view.recommendedId === s.id;
          const blocked = policy.blockedSupplierIds.includes(s.id);
          const saved = latest && first ? (first.unitPriceCents - latest.unitPriceCents) * quantity : 0;
          const prices = s.offers.map((o) => o.unitPriceCents).filter((p, i, all) => i === 0 || p !== all[i - 1]);
          const floor = scenario.suppliers.find((p) => p.id === s.id)?.floorUnitPriceCents;
          const room = first && floor !== undefined ? first.unitPriceCents - floor : 0;
          const captured = latest && first && room > 0 ? Math.min(Math.max((first.unitPriceCents - latest.unitPriceCents) / room, 0), 1) : 0;

          return (
            <article
              key={s.id}
              className={`rounded-xl border p-3 transition-all duration-300 ${
                recommended ? 'border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]' : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{s.name}</h3>
                {recommended && <span className="rounded-full bg-marker px-2.5 py-0.5 text-xs font-medium text-white">{t.recommended}</span>}
              </div>
              {s.flagged.length > 0 && <p className="mt-1 text-xs font-medium text-bad">⚠ {t.manipulation.badge}</p>}

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
                  {desk.phase === 'decided' && floor !== undefined && room > 0 && (
                    <div className="rise mt-2.5 border-t border-dashed border-line pt-2">
                      <div className="relative h-1.5 rounded-full bg-line">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-marker transition-[width] duration-700" style={{ width: `${captured * 100}%` }} />
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] text-muted">{t.floor(money(floor, lang), percent(captured))}</p>
                    </div>
                  )}
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
  desk, view, scenario, policy, lang, t, human, setHuman, cleared, edited, onEdit, locked,
}: {
  desk: DeskState; view: DeskView; scenario: Scenario; policy: Policy; lang: Lang; t: Dict;
  human: Human; setHuman: (h: Human) => void; cleared: boolean; edited: boolean;
  onEdit: (policy: Policy | null) => void; locked: boolean;
}) {
  const base = scenario.policy;
  const checks = new Map<Rule, PolicyCheck>(view.verdict?.checks.map((c) => [c.rule, c]));
  const decision = view.verdict?.decision;
  const stepOf = (value: number) => Math.max(Math.round(value / 50 / 100) * 100, 100);
  const set = (change: Partial<Policy>) => onEdit({ ...policy, ...change });

  const mark = (rule: Rule) => {
    const check = checks.get(rule);
    const symbol = !check ? '·' : check.passed ? '✓' : rule === 'auto_limit' ? '!' : '✕';
    const color = !check ? 'text-muted' : check.passed ? 'text-ok' : rule === 'auto_limit' ? 'text-warn' : 'text-bad';
    return <span className={`w-4 shrink-0 text-center font-mono ${color}`}>{symbol}</span>;
  };

  const download = async () => {
    const supplier = desk.suppliers.find((s) => s.id === view.recommendedId);
    const offer = supplier?.offers.at(-1);
    if (!supplier || !offer || !desk.request || !view.verdict) return;
    const { buildPurchaseOrder } = await import('../lib/po');
    const bytes = await buildPurchaseOrder({
      lang,
      orderNo: `RG-${Date.now().toString(36).toUpperCase()}`,
      date: new Date(),
      request: desk.request,
      supplierName: supplier.name,
      offer,
      totalCents: view.verdict.totalCents,
      approval: human === 'approved' ? 'human' : 'auto',
      explanation: view.whatIf || !desk.recommendation || desk.recommendation.forced ? '' : desk.recommendation.explanation,
    });
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `regateo-${supplier.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stampKey = human === 'approved' ? 'approved' : human === 'rejected' ? 'declined' : decision;
  const stampTone: Record<string, string> = { auto: 'text-ok', approved: 'text-ok', needs_approval: 'text-warn', rejected: 'text-bad', declined: 'text-bad' };

  return (
    <Panel
      title={t.rules}
      aside={edited && (
        <button type="button" onClick={() => onEdit(null)} className="font-mono text-[11px] uppercase tracking-widest text-marker underline underline-offset-4">
          {t.edit.reset}
        </button>
      )}
    >
      <fieldset disabled={locked} className="flex flex-col gap-3 text-sm disabled:opacity-60">
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            {mark('budget')}
            <span className="flex-1">{t.edit.budget}</span>
            <output className="font-mono">{money(policy.maxTotalCents, lang)}</output>
          </span>
          <input
            type="range" className="slider" aria-label={t.edit.budget}
            min={Math.round(base.maxTotalCents * 0.6)} max={Math.round(base.maxTotalCents * 1.4)} step={stepOf(base.maxTotalCents)}
            value={policy.maxTotalCents} onChange={(e) => set({ maxTotalCents: Number(e.target.value) })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            {mark('auto_limit')}
            <span className="flex-1">{t.edit.autoLimit}</span>
            <output className="font-mono">{money(policy.autoApproveUpToCents, lang)}</output>
          </span>
          <input
            type="range" className="slider" aria-label={t.edit.autoLimit}
            min={0} max={Math.round(base.maxTotalCents * 1.4)} step={stepOf(base.maxTotalCents)}
            value={policy.autoApproveUpToCents} onChange={(e) => set({ autoApproveUpToCents: Number(e.target.value) })}
          />
        </label>

        <div className="flex items-center gap-2">
          {mark('delivery')}
          <span className="flex-1">{t.edit.delivery}</span>
          <button type="button" aria-label="−" onClick={() => set({ maxDeliveryDays: Math.max(1, policy.maxDeliveryDays - 1) })} className="h-7 w-7 rounded-full border border-line font-mono hover:border-ink">−</button>
          <output className="w-6 text-center font-mono">{policy.maxDeliveryDays}</output>
          <button type="button" aria-label="+" onClick={() => set({ maxDeliveryDays: Math.min(30, policy.maxDeliveryDays + 1) })} className="h-7 w-7 rounded-full border border-line font-mono hover:border-ink">+</button>
        </div>

        <div>
          <span className="flex items-center gap-2">
            {mark('supplier_allowed')}
            <span>{t.edit.blocked}</span>
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
            {scenario.suppliers.map((s) => {
              const on = policy.blockedSupplierIds.includes(s.id);
              return (
                <button
                  key={s.id} type="button" aria-pressed={on}
                  onClick={() => set({ blockedSupplierIds: on ? policy.blockedSupplierIds.filter((id) => id !== s.id) : [...policy.blockedSupplierIds, s.id] })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-bad bg-bad/10 text-bad line-through' : 'border-line text-muted hover:border-ink'}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <p className="mt-3 text-xs text-muted">{t.edit.hint}</p>

      {decision && stampKey && (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
          <p key={stampKey} className={`stamp self-center ${stampTone[stampKey]}`}>
            {t.stamp[stampKey as keyof Dict['stamp']]}
          </p>
          <p className="text-sm text-muted">{t.verdict[decision as Decision]}</p>
          {decision === 'needs_approval' && human === null && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setHuman('approved')} className="press rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-medium text-paper">
                {t.approve}
              </button>
              <button type="button" onClick={() => setHuman('rejected')} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                {t.reject}
              </button>
            </div>
          )}
          {cleared && (
            <button type="button" onClick={download} className="press rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-medium">
              ↓ {t.downloadPo}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

function Receipt({ desk, t }: { desk: DeskState; t: Dict }) {
  const calls = desk.trace;
  const tokens = calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
  const ms = calls.reduce((sum, c) => sum + c.ms, 0);
  const name = (id?: string) => desk.suppliers.find((s) => s.id === id)?.name ?? id ?? '';

  return (
    <section className="receipt px-4 pb-7 pt-4 font-mono text-xs" aria-label={t.receipt.title}>
      <h2 className="text-center uppercase tracking-widest">{t.receipt.title}</h2>
      <p className="mb-2 text-center text-muted">· · · · · · · · · · · ·</p>
      {calls.length === 0 ? (
        <p className="py-4 text-center text-muted">{t.receipt.empty}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-0.5">
            {calls.map((c, i) => (
              <li key={i} className="rise flex justify-between gap-2">
                <span className="truncate">
                  {String(i + 1).padStart(2, '0')} {c.role === 'agent' ? t.receipt.agent : name(c.supplierId)}
                  {c.attempts > 1 && <span className="text-warn"> ({t.receipt.retry(c.attempts)})</span>}
                </span>
                <span className="shrink-0 text-muted">
                  {c.ms} ms · {c.inputTokens + c.outputTokens} tok
                </span>
              </li>
            ))}
          </ol>
          <dl className="mt-3 flex flex-col gap-0.5 border-t border-dashed border-ink/40 pt-2">
            {[
              [t.receipt.calls, String(calls.length)],
              [t.receipt.tokens, tokens.toLocaleString('es-AR')],
              [t.receipt.time, `${(ms / 1000).toFixed(1)} s`],
              [t.receipt.cost, t.receipt.free],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <p className="mt-3 text-center font-sans text-[11px] text-muted">{t.receipt.note}</p>
    </section>
  );
}
