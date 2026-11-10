# Regateo — Plan 1 de 3: motor del agente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un motor que, dado un pedido de compra y las reglas del dueño, negocia con proveedores simulados, recomienda una oferta y deja que el servidor decida si se compra — corriendo desde la terminal con un LLM real.

**Architecture:** Lógica pura en `src/core/` sin dependencias de Next.js. El agente y los proveedores hablan con el LLM a través de una interfaz `LLM` de un solo método; los tests usan un LLM guionado y la demo usa Gemini. El agente emite eventos; nada más conoce la UI.

**Tech Stack:** Next.js (App Router, TypeScript), zod, vitest, tsx, `@google/genai`.

**Spec:** `docs/specs/2026-11-10-agente-compras-design.md`

## Los tres planes

| Plan | Entrega | Estado |
|---|---|---|
| 1. Motor (este) | `npm run demo` imprime una negociación real en la terminal; reglas y agente con tests | Por hacer |
| 2. Mesa de control | UI en vivo por streaming, corridas guardadas en Supabase, modo demo grabado, límite de uso, ES/EN | Se escribe al terminar el 1 |
| 3. Cierre | Aprobación humana, PDF, página de evals, deploy, README, entrada del CV | Se escribe al terminar el 2 |

Cada plan se escribe cuando el anterior funciona, para que use los tipos reales y no supuestos.

## Decisión respecto del spec

El spec listaba `comparar_ofertas` como herramienta del agente. Acá la comparación es código determinista (`rank.ts`): el agente ve la tabla de ofertas en cada turno y solo elige entre `request_quote`, `counter_offer` y `recommend`. Motivo: un ranking calculado no puede alucinar.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `src/core/types.ts` | Tipos del dominio |
| `src/core/policy.ts` | Reglas del dueño → decisión |
| `src/core/rank.ts` | Ordena ofertas |
| `src/core/llm.ts` | Interfaz `LLM` y `ScriptedLLM` para tests |
| `src/core/supplier.ts` | Un turno de un proveedor simulado, con validación de piso |
| `src/core/events.ts` | Tipos de eventos de una corrida |
| `src/core/agent.ts` | Bucle del agente |
| `src/core/scenarios.ts` | Escenarios de ejemplo |
| `src/core/gemini.ts` | Adaptador `LLM` para Gemini |
| `scripts/demo.ts` | Corre un escenario e imprime los eventos |

Importes siempre en centavos enteros. Imports relativos dentro de `src/core/` (sin alias), así vitest no necesita configuración extra.

---

### Task 0: Scaffold

**Files:** raíz del proyecto en `/Users/joacolasca/agente-compras`

- [ ] **Step 1: Crear la app**

```bash
cd /Users/joacolasca/agente-compras && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: termina con "Success!". Si se queja de que la carpeta no está vacía por `docs/`, mover `docs` a `/tmp/regateo-docs`, repetir y devolverla.

- [ ] **Step 2: Dependencias**

```bash
npm install zod @google/genai && npm install -D vitest tsx
```

- [ ] **Step 3: Scripts en `package.json`** — agregar dentro de `"scripts"`:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit",
"demo": "tsx --env-file=.env.local scripts/demo.ts"
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npx vitest run --passWithNoTests`
Expected: sin errores; "No test files found" con exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js, vitest y zod"
```

---

### Task 1: Tipos del dominio

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Escribir los tipos**

```ts
export type Cents = number;

export interface PurchaseRequest {
  product: string;
  quantity: number;
  deadlineDays: number;
  budgetCents: Cents;
}

export interface Policy {
  maxTotalCents: Cents;
  autoApproveUpToCents: Cents;
  maxDeliveryDays: number;
  blockedSupplierIds: string[];
}

export interface SupplierProfile {
  id: string;
  name: string;
  persona: string;
  listUnitPriceCents: Cents;
  floorUnitPriceCents: Cents;
  deliveryDays: number;
  fastestDeliveryDays: number;
}

export interface Offer {
  supplierId: string;
  unitPriceCents: Cents;
  deliveryDays: number;
  round: number;
}

export interface ChatMessage {
  from: 'agent' | 'supplier';
  text: string;
}

export interface Scenario {
  id: string;
  request: PurchaseRequest;
  policy: Policy;
  suppliers: SupplierProfile[];
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npm run typecheck` → sin errores.

```bash
git add src/core/types.ts && git commit -m "feat(core): tipos del dominio"
```

---

### Task 2: Reglas del dueño

**Files:**
- Create: `src/core/policy.ts`
- Test: `src/core/policy.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateOffer } from './policy';
import type { Offer, Policy } from './types';

const policy: Policy = {
  maxTotalCents: 12_000_000,
  autoApproveUpToCents: 8_000_000,
  maxDeliveryDays: 5,
  blockedSupplierIds: ['blocked'],
};
const offer = (over: Partial<Offer> = {}): Offer => ({
  supplierId: 's1', unitPriceCents: 15_000, deliveryDays: 5, round: 1, ...over,
});

describe('evaluateOffer', () => {
  it('compra sola cuando todo cumple y está bajo el umbral', () => {
    const r = evaluateOffer(offer(), 500, policy);
    expect(r.totalCents).toBe(7_500_000);
    expect(r.decision).toBe('auto');
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('el umbral es inclusivo', () => {
    expect(evaluateOffer(offer({ unitPriceCents: 16_000 }), 500, policy).decision).toBe('auto');
  });

  it('pide aprobación sobre el umbral y dentro del presupuesto', () => {
    const r = evaluateOffer(offer({ unitPriceCents: 23_200 }), 500, policy);
    expect(r.decision).toBe('needs_approval');
    expect(r.checks.find((c) => c.rule === 'auto_limit')).toMatchObject({
      passed: false, actual: 11_600_000, limit: 8_000_000,
    });
  });

  it('rechaza si supera el presupuesto', () => {
    expect(evaluateOffer(offer({ unitPriceCents: 25_100 }), 500, policy).decision).toBe('rejected');
  });

  it('rechaza si llega tarde', () => {
    expect(evaluateOffer(offer({ deliveryDays: 6 }), 500, policy).decision).toBe('rejected');
  });

  it('rechaza a un proveedor bloqueado', () => {
    const r = evaluateOffer(offer({ supplierId: 'blocked' }), 500, policy);
    expect(r.decision).toBe('rejected');
    expect(r.checks.find((c) => c.rule === 'supplier_allowed')?.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/core/policy.test.ts`
Expected: FAIL, no encuentra `./policy`.

- [ ] **Step 3: Implementación**

```ts
import type { Cents, Offer, Policy } from './types';

export type Decision = 'auto' | 'needs_approval' | 'rejected';
export type Rule = 'budget' | 'delivery' | 'supplier_allowed' | 'auto_limit';

export interface PolicyCheck {
  rule: Rule;
  passed: boolean;
  actual?: number;
  limit?: number;
}

export interface PolicyResult {
  decision: Decision;
  totalCents: Cents;
  checks: PolicyCheck[];
}

export function evaluateOffer(offer: Offer, quantity: number, policy: Policy): PolicyResult {
  const totalCents = offer.unitPriceCents * quantity;
  const hard: PolicyCheck[] = [
    { rule: 'budget', passed: totalCents <= policy.maxTotalCents, actual: totalCents, limit: policy.maxTotalCents },
    { rule: 'delivery', passed: offer.deliveryDays <= policy.maxDeliveryDays, actual: offer.deliveryDays, limit: policy.maxDeliveryDays },
    { rule: 'supplier_allowed', passed: !policy.blockedSupplierIds.includes(offer.supplierId) },
  ];
  const autoLimit: PolicyCheck = {
    rule: 'auto_limit', passed: totalCents <= policy.autoApproveUpToCents,
    actual: totalCents, limit: policy.autoApproveUpToCents,
  };
  const decision: Decision = hard.some((c) => !c.passed)
    ? 'rejected'
    : autoLimit.passed ? 'auto' : 'needs_approval';
  return { decision, totalCents, checks: [...hard, autoLimit] };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/core/policy.test.ts` → 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/policy.ts src/core/policy.test.ts && git commit -m "feat(core): reglas del dueño"
```

---

### Task 3: Ranking

**Files:**
- Create: `src/core/rank.ts`
- Test: `src/core/rank.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { rankOffers } from './rank';
import type { Offer, Policy } from './types';

const policy: Policy = {
  maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000,
  maxDeliveryDays: 5, blockedSupplierIds: [],
};
const o = (supplierId: string, unitPriceCents: number, deliveryDays: number): Offer =>
  ({ supplierId, unitPriceCents, deliveryDays, round: 1 });

describe('rankOffers', () => {
  it('pone primero las que cumplen las reglas, después por total', () => {
    const rows = rankOffers([o('barato-tarde', 21_900, 7), o('caro', 23_800, 5), o('medio', 23_200, 5)], 500, policy);
    expect(rows.map((r) => r.offer.supplierId)).toEqual(['medio', 'caro', 'barato-tarde']);
    expect(rows[2].decision).toBe('rejected');
  });

  it('desempata por plazo de entrega', () => {
    const rows = rankOffers([o('lento', 20_000, 5), o('rapido', 20_000, 3)], 500, policy);
    expect(rows[0].offer.supplierId).toBe('rapido');
  });

  it('devuelve lista vacía sin ofertas', () => {
    expect(rankOffers([], 500, policy)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/core/rank.test.ts` → FAIL, no encuentra `./rank`.

- [ ] **Step 3: Implementación**

```ts
import { evaluateOffer, type PolicyResult } from './policy';
import type { Offer, Policy } from './types';

export interface RankRow extends PolicyResult {
  offer: Offer;
}

export function rankOffers(offers: Offer[], quantity: number, policy: Policy): RankRow[] {
  return offers
    .map((offer) => ({ offer, ...evaluateOffer(offer, quantity, policy) }))
    .sort((a, b) =>
      Number(a.decision === 'rejected') - Number(b.decision === 'rejected') ||
      a.totalCents - b.totalCents ||
      a.offer.deliveryDays - b.offer.deliveryDays,
    );
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/core/rank.test.ts` → 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/rank.ts src/core/rank.test.ts && git commit -m "feat(core): ranking de ofertas"
```

---

### Task 4: Interfaz LLM y LLM guionado

**Files:**
- Create: `src/core/llm.ts`
- Test: `src/core/llm.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ScriptedLLM } from './llm';

const schema = z.object({ n: z.number() });

describe('ScriptedLLM', () => {
  it('devuelve las respuestas en orden y registra las llamadas', async () => {
    const llm = new ScriptedLLM([{ n: 1 }, { n: 2 }]);
    expect(await llm.generateJson({ system: 's', prompt: 'a', schema })).toEqual({ n: 1 });
    expect(await llm.generateJson({ system: 's', prompt: 'b', schema })).toEqual({ n: 2 });
    expect(llm.calls.map((c) => c.prompt)).toEqual(['a', 'b']);
  });

  it('falla si la respuesta no cumple el schema', async () => {
    const llm = new ScriptedLLM([{ n: 'x' }]);
    await expect(llm.generateJson({ system: 's', prompt: 'a', schema })).rejects.toThrow();
  });

  it('falla si se queda sin guion', async () => {
    const llm = new ScriptedLLM([]);
    await expect(llm.generateJson({ system: 's', prompt: 'a', schema })).rejects.toThrow('ScriptedLLM: sin respuestas');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/core/llm.test.ts` → FAIL, no encuentra `./llm`.

- [ ] **Step 3: Implementación**

```ts
import type { z } from 'zod';

export interface LLMRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

export interface LLM {
  generateJson<T>(req: LLMRequest<T>): Promise<T>;
}

export class ScriptedLLM implements LLM {
  calls: { system: string; prompt: string }[] = [];
  private queue: unknown[];

  constructor(responses: unknown[]) {
    this.queue = [...responses];
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    this.calls.push({ system: req.system, prompt: req.prompt });
    if (this.queue.length === 0) throw new Error('ScriptedLLM: sin respuestas');
    return req.schema.parse(this.queue.shift());
  }
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/core/llm.test.ts` → 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/llm.ts src/core/llm.test.ts && git commit -m "feat(core): interfaz LLM y LLM guionado"
```

---

### Task 5: Proveedor simulado

**Files:**
- Create: `src/core/supplier.ts`
- Test: `src/core/supplier.test.ts`

El LLM redacta la respuesta y propone precio y plazo. El código rechaza cualquier respuesta por debajo del piso o más rápida que el plazo mínimo: esa ronda se descarta.

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { ScriptedLLM } from './llm';
import { supplierReply } from './supplier';
import type { PurchaseRequest, SupplierProfile } from './types';

const profile: SupplierProfile = {
  id: 's1', name: 'Envases Sur', persona: 'Directo, cede poco.',
  listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5,
};
const request: PurchaseRequest = { product: 'vasos térmicos 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 };
const history = [{ from: 'agent' as const, text: '¿Precio y plazo?' }];

describe('supplierReply', () => {
  it('devuelve la oferta cuando respeta el piso y el plazo', async () => {
    const llm = new ScriptedLLM([{ message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 }]);
    const r = await supplierReply(llm, profile, request, history, 2);
    expect(r).toEqual({
      ok: true, message: '$232, el lunes.',
      offer: { supplierId: 's1', unitPriceCents: 23_200, deliveryDays: 5, round: 2 },
    });
  });

  it('incluye la ficha oculta en el system y la conversación en el prompt', async () => {
    const llm = new ScriptedLLM([{ message: 'ok', unitPriceCents: 24_800, deliveryDays: 6 }]);
    await supplierReply(llm, profile, request, history, 1);
    expect(llm.calls[0].system).toContain('22500');
    expect(llm.calls[0].prompt).toContain('¿Precio y plazo?');
  });

  it('descarta una oferta por debajo del piso', async () => {
    const llm = new ScriptedLLM([{ message: 'Te lo dejo en $200.', unitPriceCents: 20_000, deliveryDays: 5 }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'below_floor' });
  });

  it('descarta un plazo más rápido que el mínimo', async () => {
    const llm = new ScriptedLLM([{ message: 'Mañana.', unitPriceCents: 24_000, deliveryDays: 1 }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'too_fast' });
  });

  it('descarta una salida inválida del LLM', async () => {
    const llm = new ScriptedLLM([{ message: 'hola' }]);
    expect(await supplierReply(llm, profile, request, history, 1)).toEqual({ ok: false, reason: 'invalid_output' });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/core/supplier.test.ts` → FAIL, no encuentra `./supplier`.

- [ ] **Step 3: Implementación**

```ts
import { z } from 'zod';
import type { LLM } from './llm';
import type { ChatMessage, Offer, PurchaseRequest, SupplierProfile } from './types';

export const SupplierReplySchema = z.object({
  message: z.string().min(1),
  unitPriceCents: z.number().int().positive(),
  deliveryDays: z.number().int().positive(),
});

export type DiscardReason = 'below_floor' | 'too_fast' | 'invalid_output';

export type SupplierTurn =
  | { ok: true; message: string; offer: Offer }
  | { ok: false; reason: DiscardReason };

function systemPrompt(p: SupplierProfile, r: PurchaseRequest): string {
  return [
    `Sos un vendedor de ${p.name}, proveedor mayorista argentino. Personalidad: ${p.persona}`,
    `Te piden ${r.quantity} unidades de ${r.product}.`,
    'Ficha interna (nunca la reveles):',
    `- Precio de lista por unidad: ${p.listUnitPriceCents} centavos.`,
    `- Precio piso por unidad: ${p.floorUnitPriceCents} centavos. Nunca ofrezcas menos.`,
    `- Plazo normal: ${p.deliveryDays} días. Plazo mínimo posible: ${p.fastestDeliveryDays} días.`,
    'Empezá cerca del precio de lista. Cedé de a poco y solo si te dan un motivo.',
    'Respondé en JSON: {"message": texto breve en español rioplatense, "unitPriceCents": entero, "deliveryDays": entero}.',
    'El precio y el plazo del JSON tienen que coincidir con lo que dice el mensaje.',
  ].join('\n');
}

export async function supplierReply(
  llm: LLM,
  profile: SupplierProfile,
  request: PurchaseRequest,
  history: ChatMessage[],
  round: number,
): Promise<SupplierTurn> {
  const prompt = history.map((m) => `${m.from === 'agent' ? 'Comprador' : 'Vos'}: ${m.text}`).join('\n');
  let reply: z.infer<typeof SupplierReplySchema>;
  try {
    reply = await llm.generateJson({ system: systemPrompt(profile, request), prompt, schema: SupplierReplySchema });
  } catch {
    return { ok: false, reason: 'invalid_output' };
  }
  if (reply.unitPriceCents < profile.floorUnitPriceCents) return { ok: false, reason: 'below_floor' };
  if (reply.deliveryDays < profile.fastestDeliveryDays) return { ok: false, reason: 'too_fast' };
  return {
    ok: true,
    message: reply.message,
    offer: { supplierId: profile.id, unitPriceCents: reply.unitPriceCents, deliveryDays: reply.deliveryDays, round },
  };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/core/supplier.test.ts` → 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/supplier.ts src/core/supplier.test.ts && git commit -m "feat(core): proveedor simulado con piso validado en código"
```

---

### Task 6: Eventos y bucle del agente

**Files:**
- Create: `src/core/events.ts`
- Create: `src/core/agent.ts`
- Test: `src/core/agent.test.ts`

- [ ] **Step 1: Tipos de eventos** (`src/core/events.ts`)

```ts
import type { PolicyResult } from './policy';
import type { RankRow } from './rank';
import type { DiscardReason } from './supplier';
import type { Offer, Policy, PurchaseRequest } from './types';

export type AgentDiscardReason = DiscardReason | 'round_limit' | 'no_offer_yet' | 'unknown_supplier';

export type RunEvent =
  | { type: 'run_started'; request: PurchaseRequest; policy: Policy; suppliers: { id: string; name: string }[] }
  | { type: 'agent_message'; supplierId: string; tool: 'request_quote' | 'counter_offer'; round: number; text: string }
  | { type: 'supplier_message'; supplierId: string; text: string; offer: Offer }
  | { type: 'round_discarded'; supplierId: string; reason: AgentDiscardReason }
  | { type: 'ranking'; rows: RankRow[] }
  | { type: 'recommendation'; supplierId: string; explanation: string; forced: boolean }
  | { type: 'policy_result'; supplierId: string; result: PolicyResult }
  | { type: 'error'; message: 'agent_llm_failed' | 'no_offers' };

export type Emit = (event: RunEvent) => void;
```

- [ ] **Step 2: Test que falla** (`src/core/agent.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { runAgent } from './agent';
import type { RunEvent } from './events';
import { ScriptedLLM } from './llm';
import type { Scenario } from './types';

const scenario: Scenario = {
  id: 't',
  request: { product: 'vasos térmicos 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 },
  policy: { maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000, maxDeliveryDays: 5, blockedSupplierIds: [] },
  suppliers: [
    { id: 's1', name: 'Envases Sur', persona: 'Directo.', listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5 },
    { id: 's2', name: 'PackNorte', persona: 'Rígido.', listUnitPriceCents: 25_100, floorUnitPriceCents: 24_500, deliveryDays: 5, fastestDeliveryDays: 5 },
  ],
};

async function run(agentScript: unknown[], supplierScript: unknown[]) {
  const events: RunEvent[] = [];
  const result = await runAgent(
    { agentLlm: new ScriptedLLM(agentScript), supplierLlm: new ScriptedLLM(supplierScript) },
    scenario,
    (e) => events.push(e),
  );
  return { events, result };
}

describe('runAgent', () => {
  it('cotiza, negocia, recomienda y el servidor decide', async () => {
    const { events, result } = await run(
      [
        { tool: 'request_quote', supplierId: 's1', message: '¿Precio y plazo?' },
        { tool: 'request_quote', supplierId: 's2', message: '¿Precio y plazo?' },
        { tool: 'counter_offer', supplierId: 's1', message: 'Si llegás el lunes a $225, cierro.' },
        { tool: 'recommend', supplierId: 's1', explanation: 'Cumple fecha y presupuesto.' },
      ],
      [
        { message: '$248, el martes.', unitPriceCents: 24_800, deliveryDays: 6 },
        { message: '$251, el lunes.', unitPriceCents: 25_100, deliveryDays: 5 },
        { message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 },
      ],
    );
    expect(events.map((e) => e.type)).toEqual([
      'run_started',
      'agent_message', 'supplier_message',
      'agent_message', 'supplier_message',
      'agent_message', 'supplier_message',
      'ranking', 'recommendation', 'policy_result',
    ]);
    expect(result).toEqual({ status: 'done', supplierId: 's1', decision: 'needs_approval', totalCents: 11_600_000, forced: false });
  });

  it('conserva la oferta anterior si el proveedor baja del piso', async () => {
    const { events, result } = await run(
      [
        { tool: 'request_quote', supplierId: 's1', message: '¿Precio?' },
        { tool: 'counter_offer', supplierId: 's1', message: 'Bajá a $200.' },
        { tool: 'recommend', supplierId: 's1', explanation: 'Única oferta.' },
      ],
      [
        { message: '$240, el lunes.', unitPriceCents: 24_000, deliveryDays: 5 },
        { message: '$200.', unitPriceCents: 20_000, deliveryDays: 5 },
      ],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's1', reason: 'below_floor' });
    expect(result).toMatchObject({ status: 'done', totalCents: 12_000_000 });
  });

  it('no permite más de 3 rondas por proveedor', async () => {
    const ask = { tool: 'counter_offer', supplierId: 's1', message: 'Bajá más.' };
    const reply = { message: '$240.', unitPriceCents: 24_000, deliveryDays: 5 };
    const { events } = await run(
      [{ tool: 'request_quote', supplierId: 's1', message: '¿Precio?' }, ask, ask, ask, { tool: 'recommend', supplierId: 's1', explanation: 'Listo.' }],
      [reply, reply, reply],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's1', reason: 'round_limit' });
  });

  it('rechaza recomendar a un proveedor sin oferta y sigue', async () => {
    const { events, result } = await run(
      [
        { tool: 'recommend', supplierId: 's2', explanation: 'Porque sí.' },
        { tool: 'request_quote', supplierId: 's2', message: '¿Precio?' },
        { tool: 'recommend', supplierId: 's2', explanation: 'Ahora sí.' },
      ],
      [{ message: '$245, el lunes.', unitPriceCents: 24_500, deliveryDays: 5 }],
    );
    expect(events).toContainEqual({ type: 'round_discarded', supplierId: 's2', reason: 'no_offer_yet' });
    expect(result).toMatchObject({ status: 'done', supplierId: 's2', decision: 'rejected' });
  });

  it('si el LLM del agente falla, recomienda la mejor oferta que tenga', async () => {
    const { events, result } = await run(
      [{ tool: 'request_quote', supplierId: 's1', message: '¿Precio?' }],
      [{ message: '$232, el lunes.', unitPriceCents: 23_200, deliveryDays: 5 }],
    );
    expect(events).toContainEqual({ type: 'error', message: 'agent_llm_failed' });
    expect(result).toMatchObject({ status: 'done', supplierId: 's1', forced: true });
  });

  it('falla limpio si no hay ninguna oferta', async () => {
    const { events, result } = await run([], []);
    expect(events.at(-1)).toEqual({ type: 'error', message: 'no_offers' });
    expect(result).toEqual({ status: 'failed' });
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `npx vitest run src/core/agent.test.ts` → FAIL, no encuentra `./agent`.

- [ ] **Step 4: Implementación** (`src/core/agent.ts`)

```ts
import { z } from 'zod';
import type { Emit } from './events';
import type { LLM } from './llm';
import { evaluateOffer, type Decision } from './policy';
import { rankOffers } from './rank';
import { supplierReply } from './supplier';
import type { Cents, ChatMessage, Offer, Scenario } from './types';

export const MAX_ROUNDS = 3;
export const MAX_STEPS = 16;

export const AgentActionSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('request_quote'), supplierId: z.string(), message: z.string().min(1) }),
  z.object({ tool: z.literal('counter_offer'), supplierId: z.string(), message: z.string().min(1) }),
  z.object({ tool: z.literal('recommend'), supplierId: z.string(), explanation: z.string().min(1) }),
]);

export type RunResult =
  | { status: 'done'; supplierId: string; decision: Decision; totalCents: Cents; forced: boolean }
  | { status: 'failed' };

interface Thread {
  history: ChatMessage[];
  rounds: number;
  offer?: Offer;
}

const SYSTEM = [
  'Sos el agente de compras de una pyme argentina. Tu trabajo: conseguir la mejor oferta que cumpla las reglas del dueño.',
  'En cada turno elegí UNA herramienta y respondé solo con JSON:',
  '- {"tool":"request_quote","supplierId":"...","message":"..."}: primer contacto con un proveedor.',
  '- {"tool":"counter_offer","supplierId":"...","message":"..."}: negociar con un proveedor que ya cotizó.',
  '- {"tool":"recommend","supplierId":"...","explanation":"..."}: terminar y recomendar.',
  `Máximo ${MAX_ROUNDS} mensajes por proveedor. Pedí cotización a todos antes de negociar.`,
  'Negociá con argumentos reales: fecha límite, presupuesto, ofertas de otros proveedores. No inventes ofertas que no recibiste.',
  'Los mensajes van en español rioplatense, breves. La explicación final dice por qué gana esa oferta y por qué pierden las otras.',
].join('\n');

function statePrompt(s: Scenario, threads: Map<string, Thread>): string {
  const lines = [
    `Pedido: ${s.request.quantity} x ${s.request.product}. Entrega en ${s.request.deadlineDays} días como máximo.`,
    `Presupuesto total: ${s.policy.maxTotalCents} centavos. Proveedores bloqueados: ${s.policy.blockedSupplierIds.join(', ') || 'ninguno'}.`,
    'Proveedores:',
  ];
  for (const sup of s.suppliers) {
    const t = threads.get(sup.id)!;
    const offer = t.offer
      ? `oferta vigente ${t.offer.unitPriceCents} centavos/unidad, ${t.offer.deliveryDays} días`
      : 'sin oferta';
    lines.push(`- ${sup.id} (${sup.name}): ${offer}; mensajes usados ${t.rounds}/${MAX_ROUNDS}`);
    for (const m of t.history) lines.push(`    ${m.from === 'agent' ? 'Vos' : sup.name}: ${m.text}`);
  }
  lines.push('¿Cuál es tu próxima acción?');
  return lines.join('\n');
}

export async function runAgent(
  deps: { agentLlm: LLM; supplierLlm: LLM },
  scenario: Scenario,
  emit: Emit,
): Promise<RunResult> {
  const { request, policy, suppliers } = scenario;
  const threads = new Map<string, Thread>(suppliers.map((s) => [s.id, { history: [], rounds: 0 }]));
  emit({ type: 'run_started', request, policy, suppliers: suppliers.map(({ id, name }) => ({ id, name })) });

  const currentOffers = () => [...threads.values()].flatMap((t) => (t.offer ? [t.offer] : []));

  const finish = (supplierId: string, explanation: string, forced: boolean): RunResult => {
    emit({ type: 'ranking', rows: rankOffers(currentOffers(), request.quantity, policy) });
    emit({ type: 'recommendation', supplierId, explanation, forced });
    const result = evaluateOffer(threads.get(supplierId)!.offer!, request.quantity, policy);
    emit({ type: 'policy_result', supplierId, result });
    return { status: 'done', supplierId, decision: result.decision, totalCents: result.totalCents, forced };
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    let action: z.infer<typeof AgentActionSchema>;
    try {
      action = await deps.agentLlm.generateJson({ system: SYSTEM, prompt: statePrompt(scenario, threads), schema: AgentActionSchema });
    } catch {
      emit({ type: 'error', message: 'agent_llm_failed' });
      break;
    }

    const profile = suppliers.find((s) => s.id === action.supplierId);
    const thread = threads.get(action.supplierId);
    if (!profile || !thread) {
      emit({ type: 'round_discarded', supplierId: action.supplierId, reason: 'unknown_supplier' });
      continue;
    }

    if (action.tool === 'recommend') {
      if (!thread.offer) {
        emit({ type: 'round_discarded', supplierId: profile.id, reason: 'no_offer_yet' });
        continue;
      }
      return finish(profile.id, action.explanation, false);
    }

    if (action.tool === 'counter_offer' && !thread.offer) {
      emit({ type: 'round_discarded', supplierId: profile.id, reason: 'no_offer_yet' });
      continue;
    }
    if (thread.rounds >= MAX_ROUNDS) {
      emit({ type: 'round_discarded', supplierId: profile.id, reason: 'round_limit' });
      continue;
    }

    thread.rounds += 1;
    thread.history.push({ from: 'agent', text: action.message });
    emit({ type: 'agent_message', supplierId: profile.id, tool: action.tool, round: thread.rounds, text: action.message });

    const turn = await supplierReply(deps.supplierLlm, profile, request, thread.history, thread.rounds);
    if (!turn.ok) {
      emit({ type: 'round_discarded', supplierId: profile.id, reason: turn.reason });
      continue;
    }
    thread.offer = turn.offer;
    thread.history.push({ from: 'supplier', text: turn.message });
    emit({ type: 'supplier_message', supplierId: profile.id, text: turn.message, offer: turn.offer });
  }

  const best = rankOffers(currentOffers(), request.quantity, policy)[0];
  if (!best) {
    emit({ type: 'error', message: 'no_offers' });
    return { status: 'failed' };
  }
  return finish(best.offer.supplierId, 'Recomendación automática: se alcanzó el límite del agente y esta es la oferta mejor rankeada.', true);
}
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `npx vitest run src/core/agent.test.ts` → 6 passed.

Nota del test "falla limpio": con guion vacío el LLM del agente falla en el primer paso, se emite `agent_llm_failed` y después `no_offers`; por eso el test mira el último evento.

- [ ] **Step 6: Suite completa y commit**

Run: `npm test && npm run typecheck` → todo verde.

```bash
git add src/core/events.ts src/core/agent.ts src/core/agent.test.ts && git commit -m "feat(core): bucle del agente con eventos"
```

---

### Task 7: Escenarios de ejemplo

**Files:**
- Create: `src/core/scenarios.ts`
- Test: `src/core/scenarios.test.ts`

Datos ficticios. Los proveedores y precios son inventados para la demo y se rotulan así en la UI (plan 2).

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';

describe('scenarios', () => {
  it('tienen ids únicos y al menos 3 proveedores', () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    for (const s of scenarios) expect(s.suppliers.length).toBeGreaterThanOrEqual(3);
  });

  it('cada proveedor tiene piso <= lista y plazo mínimo <= plazo normal', () => {
    for (const sup of scenarios.flatMap((s) => s.suppliers)) {
      expect(sup.floorUnitPriceCents).toBeLessThanOrEqual(sup.listUnitPriceCents);
      expect(sup.fastestDeliveryDays).toBeLessThanOrEqual(sup.deliveryDays);
    }
  });

  it('cada escenario tiene al menos un proveedor que puede cumplir las reglas en su piso', () => {
    for (const s of scenarios) {
      const feasible = s.suppliers.some((sup) =>
        sup.floorUnitPriceCents * s.request.quantity <= s.policy.maxTotalCents &&
        sup.fastestDeliveryDays <= s.policy.maxDeliveryDays &&
        !s.policy.blockedSupplierIds.includes(sup.id));
      expect(feasible).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/core/scenarios.test.ts` → FAIL, no encuentra `./scenarios`.

- [ ] **Step 3: Implementación**

```ts
import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  {
    id: 'vasos-cafeteria',
    request: { product: 'vasos térmicos de 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 },
    policy: { maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000, maxDeliveryDays: 5, blockedSupplierIds: [] },
    suppliers: [
      { id: 'envases-sur', name: 'Envases Sur', persona: 'Directo y práctico. Cede si le ofrecen cerrar hoy.', listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5 },
      { id: 'descartables-ya', name: 'Descartables Ya', persona: 'Simpático, el más barato, pero no puede acelerar la entrega.', listUnitPriceCents: 22_400, floorUnitPriceCents: 21_000, deliveryDays: 7, fastestDeliveryDays: 7 },
      { id: 'packnorte', name: 'PackNorte', persona: 'Formal y rígido. Casi no negocia el precio.', listUnitPriceCents: 25_600, floorUnitPriceCents: 24_800, deliveryDays: 4, fastestDeliveryDays: 3 },
    ],
  },
  {
    id: 'cajas-ecommerce',
    request: { product: 'cajas de cartón corrugado 30x20x15', quantity: 2000, deadlineDays: 10, budgetCents: 90_000_000 },
    policy: { maxTotalCents: 90_000_000, autoApproveUpToCents: 100_000_000, maxDeliveryDays: 10, blockedSupplierIds: ['cartonera-oeste'] },
    suppliers: [
      { id: 'cartonera-oeste', name: 'Cartonera Oeste', persona: 'Agresivo con el precio. Insiste en cerrar rápido.', listUnitPriceCents: 36_000, floorUnitPriceCents: 33_000, deliveryDays: 6, fastestDeliveryDays: 5 },
      { id: 'embalajes-rio', name: 'Embalajes Río', persona: 'Cordial. Da descuento por volumen si se lo piden.', listUnitPriceCents: 44_000, floorUnitPriceCents: 39_500, deliveryDays: 9, fastestDeliveryDays: 7 },
      { id: 'corrugados-delta', name: 'Corrugados Delta', persona: 'Seco. Baja el precio solo si le nombran a la competencia.', listUnitPriceCents: 46_500, floorUnitPriceCents: 41_000, deliveryDays: 8, fastestDeliveryDays: 8 },
    ],
  },
  {
    id: 'cafe-oficina',
    request: { product: 'kilos de café en grano tostado', quantity: 40, deadlineDays: 3, budgetCents: 110_000_000 },
    policy: { maxTotalCents: 110_000_000, autoApproveUpToCents: 60_000_000, maxDeliveryDays: 3, blockedSupplierIds: [] },
    suppliers: [
      { id: 'tostadores-unidos', name: 'Tostadores Unidos', persona: 'Orgulloso de su producto. Defiende el precio con calidad.', listUnitPriceCents: 2_900_000, floorUnitPriceCents: 2_600_000, deliveryDays: 2, fastestDeliveryDays: 2 },
      { id: 'cafe-del-puerto', name: 'Café del Puerto', persona: 'Flexible. Acelera la entrega si le aseguran la compra.', listUnitPriceCents: 2_700_000, floorUnitPriceCents: 2_450_000, deliveryDays: 5, fastestDeliveryDays: 3 },
      { id: 'grano-fino', name: 'Grano Fino', persona: 'Desorganizado. Promete mucho, contesta corto.', listUnitPriceCents: 2_500_000, floorUnitPriceCents: 2_400_000, deliveryDays: 6, fastestDeliveryDays: 5 },
    ],
  },
];

export function getScenario(id: string) {
  return scenarios.find((s) => s.id === id);
}
```

Qué prueba cada escenario: `vasos-cafeteria` → termina en aprobación humana; `cajas-ecommerce` → el más barato está bloqueado; `cafe-oficina` → el más barato no llega a tiempo y hay que negociar plazo.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/core/scenarios.test.ts` → 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/scenarios.ts src/core/scenarios.test.ts && git commit -m "feat(core): escenarios de ejemplo"
```

---

### Task 8: Adaptador de Gemini y demo en terminal

**Files:**
- Create: `src/core/gemini.ts`
- Create: `scripts/demo.ts`
- Create: `.env.example`

- [ ] **Step 1: Confirmar modelo y capa gratuita**

Abrir `https://ai.google.dev/gemini-api/docs/models` y `https://ai.google.dev/gemini-api/docs/rate-limits`. Anotar en `.env.example` el ID del modelo Flash vigente con capa gratuita y sus límites por minuto y por día. Una corrida usa como máximo 16 llamadas del agente + 9 de proveedores = 25 llamadas; con ese número y el límite diario se calcula el tope de corridas en vivo del plan 2. Si la capa gratuita no alcanza para una corrida, parar y avisar a Joaquín antes de seguir.

- [ ] **Step 2: `.env.example`**

```dotenv
# Clave gratuita de Google AI Studio: https://aistudio.google.com/apikey
GEMINI_API_KEY=
# ID del modelo confirmado en el Step 1
GEMINI_MODEL=
```

Joaquín crea la clave en AI Studio y la pega en `.env.local` (ya ignorado por git). La clave nunca va al repo ni al chat.

- [ ] **Step 3: Adaptador** (`src/core/gemini.ts`)

```ts
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { LLM, LLMRequest } from './llm';

export class GeminiLLM implements LLM {
  private ai: GoogleGenAI;

  constructor(apiKey: string, private model: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T>(req: LLMRequest<T>): Promise<T> {
    const schemaText = JSON.stringify(z.toJSONSchema(req.schema));
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents: req.prompt,
          config: {
            systemInstruction: `${req.system}\n\nRespondé únicamente con JSON válido que cumpla este JSON Schema:\n${schemaText}`,
            responseMimeType: 'application/json',
          },
        });
        return req.schema.parse(JSON.parse(res.text ?? ''));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
```

Si `generateContent` o `res.text` no existen con esa forma en la versión instalada, revisar `node_modules/@google/genai/README.md` y ajustar solo este archivo: el resto del código depende de la interfaz `LLM`.

- [ ] **Step 4: Script de demo** (`scripts/demo.ts`)

```ts
import { runAgent } from '../src/core/agent';
import type { RunEvent } from '../src/core/events';
import { GeminiLLM } from '../src/core/gemini';
import { getScenario, scenarios } from '../src/core/scenarios';

const pesos = (cents: number) => `$${(cents / 100).toLocaleString('es-AR')}`;

function print(e: RunEvent) {
  switch (e.type) {
    case 'run_started':
      return console.log(`\nPedido: ${e.request.quantity} x ${e.request.product} · máximo ${pesos(e.policy.maxTotalCents)}\n`);
    case 'agent_message':
      return console.log(`[agente → ${e.supplierId}] (${e.tool}, ronda ${e.round}) ${e.text}`);
    case 'supplier_message':
      return console.log(`[${e.supplierId}] ${e.text}  → ${pesos(e.offer.unitPriceCents)} c/u, ${e.offer.deliveryDays} días`);
    case 'round_discarded':
      return console.log(`[descartado] ${e.supplierId}: ${e.reason}`);
    case 'ranking':
      console.log('\nRanking:');
      return e.rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.offer.supplierId} · ${pesos(r.totalCents)} · ${r.offer.deliveryDays} días · ${r.decision}`));
    case 'recommendation':
      return console.log(`\nRecomienda: ${e.supplierId}${e.forced ? ' (forzada)' : ''}\n${e.explanation}`);
    case 'policy_result':
      return console.log(`\nDecisión del servidor: ${e.result.decision} (${pesos(e.result.totalCents)})`);
    case 'error':
      return console.log(`[error] ${e.message}`);
  }
}

async function main() {
  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY || !GEMINI_MODEL) throw new Error('Faltan GEMINI_API_KEY o GEMINI_MODEL en .env.local');
  const scenario = getScenario(process.argv[2] ?? scenarios[0].id);
  if (!scenario) throw new Error(`Escenario desconocido. Opciones: ${scenarios.map((s) => s.id).join(', ')}`);
  const llm = new GeminiLLM(GEMINI_API_KEY, GEMINI_MODEL);
  const result = await runAgent({ agentLlm: llm, supplierLlm: llm }, scenario, print);
  console.log('\nResultado:', result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Correr los tres escenarios con el LLM real**

```bash
npm run demo -- vasos-cafeteria
```

```bash
npm run demo -- cajas-ecommerce
```

```bash
npm run demo -- cafe-oficina
```

Expected en cada uno: mensajes del agente y de los proveedores, un ranking, una recomendación y `Resultado: { status: 'done', ... }`. Revisar a ojo: que el agente contacte a todos los proveedores antes de negociar, que no invente ofertas y que en `cajas-ecommerce` no recomiende a `cartonera-oeste`. Si algo de eso falla, ajustar el texto de `SYSTEM` en `src/core/agent.ts`, volver a correr y anotar qué se cambió y por qué en el mensaje del commit. Esto es prompt engineering medido a mano; los evals del plan 3 lo vuelven sistemático.

- [ ] **Step 6: Suite completa y commit**

Run: `npm test && npm run typecheck && npm run lint` → todo verde.

```bash
git add src/core/gemini.ts scripts/demo.ts .env.example && git commit -m "feat: adaptador de Gemini y demo en terminal"
```

---

## Terminado (plan 1)

- [ ] `npm test` en verde: reglas, ranking, proveedor, agente y escenarios.
- [ ] `npm run demo` completa los tres escenarios con el LLM real.
- [ ] Ninguna clave en el repo.
- [ ] Límites de la capa gratuita anotados en `.env.example`.
