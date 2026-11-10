'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from './lang';

export const REPO_URL = 'https://github.com/joacolasca/regateo';

export function Header() {
  const { lang, t, setLang } = useLang();
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={lang === 'en' ? `${href}?lang=en` : href}
      className={`rounded-full px-3 py-1 text-sm transition-colors hover:bg-ink/5 ${path === href ? 'bg-ink/8 text-ink' : 'text-muted'}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href={lang === 'en' ? '/?lang=en' : '/'} className="font-display text-2xl leading-none tracking-tight">
          Regateo<span className="text-marker">.</span>
        </Link>
        <nav className="order-3 -mx-1 flex w-full flex-wrap items-center gap-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          {link('/', t.nav.desk)}
          {link('/evals', t.nav.evals)}
          {link('/how', t.nav.how)}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1 text-sm text-muted hover:bg-ink/5">
            {t.nav.repo} ↗
          </a>
        </nav>
        <div className="ml-auto flex overflow-hidden rounded-full border border-line text-xs" role="group" aria-label="Idioma / Language">
          {(['es', 'en'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`px-3 py-1 font-mono uppercase ${lang === code ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/5'}`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted">
        <span>{t.footer}</span>
        <span>{t.sample}</span>
      </div>
    </footer>
  );
}
