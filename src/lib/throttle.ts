// Freno en memoria para el modo en vivo. Es por instancia del servidor, así que es un
// freno de cortesía; el tope real de gasto es la capa gratuita del modelo, que no factura.
export class Throttle {
  private perKey = new Map<string, number[]>();
  private all: number[] = [];

  constructor(
    private limits: { perKey: number; perKeyWindowMs: number; global: number; globalWindowMs: number },
    private now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    this.all = this.all.filter((x) => t - x < this.limits.globalWindowMs);
    const mine = (this.perKey.get(key) ?? []).filter((x) => t - x < this.limits.perKeyWindowMs);
    if (this.all.length >= this.limits.global || mine.length >= this.limits.perKey) {
      this.perKey.set(key, mine);
      return false;
    }
    mine.push(t);
    this.all.push(t);
    this.perKey.set(key, mine);
    return true;
  }
}
