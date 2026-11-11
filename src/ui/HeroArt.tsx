'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { evaluateOffer } from '../core/policy';
import type { Lang, Policy } from '../core/types';
import type { DeskState } from './desk-state';
import { money, percent } from './format';
import type { Dict } from './i18n';

// El shader corre solo en el navegador (WebGL).
const Dithering = dynamic(() => import('@paper-design/shaders-react').then((m) => m.Dithering), { ssr: false });

/** Trama de imprenta animada con una etiqueta de precio que sigue la negociación en vivo. */
export function HeroArt({ desk, policy, lang, t }: { desk: DeskState; policy?: Policy; lang: Lang; t: Dict }) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee una preferencia del navegador al montar
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const quantity = desk.request?.quantity ?? 0;
  const candidates = policy
    ? desk.suppliers.flatMap((s) => {
        const latest = s.offers.at(-1);
        if (!latest || evaluateOffer(latest, quantity, policy).decision === 'rejected') return [];
        return [{ supplier: s, latest, first: s.offers[0] }];
      })
    : [];
  const leader = candidates.sort((a, b) => a.latest.unitPriceCents - b.latest.unitPriceCents)[0];
  const anyOffer = desk.suppliers.some((s) => s.offers.length > 0);
  const drop = leader ? (leader.first.unitPriceCents - leader.latest.unitPriceCents) / leader.first.unitPriceCents : 0;

  return (
    <div className="relative isolate min-h-[260px] overflow-hidden rounded-[28px] border border-ink bg-paper sm:min-h-[340px]">
      <div className="absolute inset-0 -z-10">
        <Dithering
          colorBack="#f3eee4"
          colorFront="#e2512a"
          shape="warp"
          type="4x4"
          size={2.4}
          scale={0.9}
          speed={still ? 0 : 0.35}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="flex h-full min-h-[inherit] items-center justify-center p-6">
        <div className="tag relative w-full max-w-[300px] -rotate-3 rounded-xl border-2 border-ink bg-card px-5 pb-5 pt-9 shadow-[6px_6px_0_0_var(--color-ink)]">
          <span className="absolute left-1/2 top-3 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-ink bg-paper" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {leader ? t.hero.best : anyOffer ? t.hero.none : t.hero.waiting}
          </p>
          {leader ? (
            <div key={`${leader.supplier.id}-${leader.latest.unitPriceCents}`} className="rise">
              <p className="mt-1 font-display text-2xl leading-tight">{leader.supplier.name}</p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3 font-mono">
                {drop > 0 && <span className="struck text-lg">{money(leader.first.unitPriceCents, lang)}</span>}
                <span className="text-4xl font-medium tracking-tight">{money(leader.latest.unitPriceCents, lang)}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                {t.days(leader.latest.deliveryDays)}
                {drop > 0 && <span className="text-marker"> · {t.hero.off(percent(drop))}</span>}
              </p>
            </div>
          ) : (
            <p className="mt-3 font-mono text-4xl tracking-tight text-muted" aria-hidden>
              $ ———
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
