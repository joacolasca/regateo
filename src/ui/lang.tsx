'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '../core/types';
import { dict, type Dict } from './i18n';

const LangContext = createContext<{ lang: Lang; t: Dict; setLang: (lang: Lang) => void }>({
  lang: 'es', t: dict.es, setLang: () => {},
});

const isLang = (value: unknown): value is Lang => value === 'es' || value === 'en';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  // El idioma llega por ?lang=en (link del CV en inglés) o por la última elección guardada.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem('lang');
    } catch {}
    const initial = isLang(fromUrl) ? fromUrl : isLang(stored) ? stored : null;
    if (initial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la URL una sola vez al montar
      setLangState(initial);
      document.documentElement.lang = initial;
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem('lang', next);
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
  }, []);

  return <LangContext.Provider value={{ lang, t: dict[lang], setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
