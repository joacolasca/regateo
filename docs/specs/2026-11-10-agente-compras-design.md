# Agente de compras para pymes — Spec de diseño

Fecha: November 10, 2026 · Autor: Joaquín Lasca · Nombre: **Regateo**

## 1. Objetivo

Un proyecto propio para el CV: un link público donde cualquiera ve un agente de IA trabajando de punta a punta, sin crear cuenta. Inspirado en el problema que ataca Tratunex (HackaTwin 2026), construido desde cero, sin código de ese repo.

Qué tiene que demostrar para el CV:

- Agente con tool calling de varios pasos.
- Reglas de negocio que hace cumplir el servidor, no el modelo.
- Human-in-the-loop (aprobación).
- Evals: medir si el agente decide bien.
- Producto terminado y desplegado, costo US$ 0.

## 2. Qué hace

1. El visitante elige un escenario (o escribe el suyo): producto, cantidad, fecha límite, presupuesto.
2. Ve las reglas del dueño: presupuesto máximo, umbral hasta el que el agente compra solo, plazo máximo, proveedores bloqueados.
3. El agente pide cotización a 3–4 proveedores y negocia con cada uno (hasta 3 rondas).
4. Compara las ofertas, arma un ranking y explica la recomendación.
5. El servidor evalúa las reglas: compra automática, pide aprobación o rechaza.
6. Si se aprueba, se genera la orden de compra en PDF.

## 3. Fuera de alcance

Pagos (cripto o reales), llamadas telefónicas, login, multiempresa, búsqueda de proveedores en la web. Voz con ElevenLabs: posible fase 2, solo pregrabada.

## 4. Arquitectura

Un solo proyecto Next.js (App Router, TypeScript) en Vercel.

| Unidad | Qué hace | Depende de |
|---|---|---|
| `agent/` | Bucle del agente: decide qué herramienta usar y cuándo terminar | `tools/`, cliente LLM |
| `tools/` | `request_quote`, `counter_offer`, `recommend`. La comparación es código determinista, no una herramienta del modelo | `suppliers/`, `policy/` |
| `suppliers/` | Proveedores simulados: cada uno es un LLM con una ficha oculta (precio piso, stock, plazo, personalidad) | cliente LLM |
| `policy/` | Función pura: oferta + reglas → `auto` / `needs_approval` / `rejected` con motivo | nada |
| `runs/` | Guarda cada corrida como lista de eventos; sirve la repetición | Supabase |
| `evals/` | Corre N escenarios con respuesta esperada y calcula el puntaje | `agent/` |
| `po/` | Genera la orden de compra en PDF | nada |
| UI | Mesa de control, página de evals, página "cómo funciona" | `runs/` |

Flujo de datos: el agente emite **eventos** (mensaje enviado, oferta recibida, regla evaluada, decisión). La UI en vivo los recibe por streaming; la demo grabada reproduce los mismos eventos desde la base. Una sola UI para los dos modos.

Decisiones:

- **El modelo propone, el servidor decide.** `policy/` es código determinista con tests; el LLM nunca aprueba una compra.
- **El proveedor simulado no puede bajar de su precio piso**: se valida en código, no se confía en el prompt.
- Importes en centavos enteros, nunca float.

## 5. Modos del link público

- **Ver demo** (por defecto): repite una corrida real grabada. Instantánea, sin costo, no falla.
- **Correr en vivo**: ejecuta el agente. Límite por IP y tope diario global; si se alcanza, cae a la demo grabada con un aviso.

## 6. Stack

Next.js, TypeScript, Tailwind, Supabase (Postgres), Vercel, zod, vitest. LLM: Gemini en capa gratuita — límites a confirmar antes de implementar; alternativa: Groq.

## 7. Pantallas

1. **Mesa de control** (home): conversaciones por proveedor · tabla comparativa · reglas del dueño · línea de pasos del agente · recomendación y botón de aprobar.
2. **Evals**: tabla de escenarios, elección esperada vs. elección del agente, puntaje total, ahorro promedio negociado.
3. **Cómo funciona**: diagrama de arquitectura y link al repo.

Todo en español e inglés (selector), porque el CV existe en los dos idiomas.

## 8. Errores

- LLM falla o agota cuota → reintento una vez; después, aviso y demo grabada.
- Proveedor responde algo inválido → se descarta esa ronda y se registra el evento.
- El agente supera el máximo de pasos → corta y recomienda con lo que tiene, avisando.

## 9. Tests

- `policy/`: tests unitarios de cada regla y sus bordes.
- `suppliers/`: nunca cotiza bajo el piso.
- `agent/`: tests con LLM simulado (respuestas fijas) para el bucle.
- Evals: aparte de los tests; usan el LLM real y se corren a mano.

## 10. Terminado

- [ ] Link público que muestra la demo sin login en menos de 3 segundos.
- [ ] Corrida en vivo funcionando con límite de uso.
- [ ] Reglas aplicadas en servidor con tests.
- [ ] Aprobación humana y PDF de orden de compra.
- [ ] Página de evals con resultados reales (sin números inventados).
- [ ] README con capturas, arquitectura y decisiones.
- [ ] Entrada para el CV en ES y EN, con las métricas que salgan de los evals.

## 11. Decisiones confirmadas (November 10, 2026)

- Nombre: **Regateo**.
- Repo público en github.com/joacolasca.
