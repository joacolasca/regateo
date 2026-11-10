import { describe, expect, it } from 'vitest';
import { Throttle } from './throttle';

describe('Throttle', () => {
  it('limita por visitante dentro de la ventana y libera al pasar el tiempo', () => {
    let now = 0;
    const t = new Throttle({ perKey: 2, perKeyWindowMs: 1000, global: 100, globalWindowMs: 10_000 }, () => now);
    expect(t.allow('a')).toBe(true);
    expect(t.allow('a')).toBe(true);
    expect(t.allow('a')).toBe(false);
    expect(t.allow('b')).toBe(true);
    now = 1001;
    expect(t.allow('a')).toBe(true);
  });

  it('aplica un tope global entre todos los visitantes', () => {
    const t = new Throttle({ perKey: 5, perKeyWindowMs: 1000, global: 2, globalWindowMs: 1000 }, () => 0);
    expect(t.allow('a')).toBe(true);
    expect(t.allow('b')).toBe(true);
    expect(t.allow('c')).toBe(false);
  });
});
