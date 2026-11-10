import type { Cents, Lang } from '../core/types';

export function money(cents: Cents, lang: Lang): string {
  const value = cents / 100;
  const digits = { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 };
  return lang === 'en'
    ? `ARS ${value.toLocaleString('en-US', digits)}`
    : `$${value.toLocaleString('es-AR', digits)}`;
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
