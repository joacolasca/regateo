# Regateo

[![CI](https://github.com/joacolasca/regateo/actions/workflows/ci.yml/badge.svg)](https://github.com/joacolasca/regateo/actions/workflows/ci.yml)

**Un agente que negocia compras para una pyme.** Pide cotización a varios proveedores, negocia con cada uno, compara las ofertas y recomienda una. Las reglas del dueño las hace cumplir el servidor, no el modelo.

*An AI agent that negotiates purchases for a small business: it requests quotes, haggles with each supplier, compares the offers and recommends one. The owner's rules are enforced by server code, never by the model. The site is available in Spanish and English.*

**Demo:** https://regateo.vercel.app · [English](https://regateo.vercel.app/?lang=en) · [Evals](https://regateo.vercel.app/evals) · [Cómo funciona](https://regateo.vercel.app/how)

![Mesa de control de Regateo](docs/screenshot.jpg)

## Qué hace

1. Recibe un pedido (producto, cantidad, plazo) y las reglas del dueño: presupuesto, plazo máximo, proveedores bloqueados y hasta cuánto puede comprar el agente sin preguntar.
2. Pide cotización a cada proveedor y negocia, con un máximo de tres mensajes por proveedor.
3. El servidor arma el ranking y evalúa la oferta recomendada contra las reglas: compra automática, pide aprobación a una persona o rechaza.
4. Si la compra se aprueba, genera la orden de compra en PDF.

Los proveedores son simulados: cada uno es un modelo con una ficha oculta (precio de lista, precio piso, plazos, personalidad). Uno de ellos es **tramposo**: mete instrucciones falsas en sus mensajes para manipular al agente. **Todos los datos son ficticios.**

## Qué se puede hacer en el sitio

- **Ver una corrida real grabada**, mensaje por mensaje, con los precios tachados a medida que bajan.
- **Correr el agente en vivo** contra el modelo, con freno de uso. Si la cuota gratuita se agota, vuelve a la grabación.
- **Mover las reglas** (presupuesto, tope de compra automática, plazo, proveedores bloqueados): el veredicto se recalcula al instante con el mismo código del servidor, sin llamar al modelo. También se puede correr en vivo con esas reglas.
- **Aprobar o rechazar** la compra y **descargar la orden de compra** en PDF.
- **Ver el ticket de la corrida**: cada llamada al modelo con latencia, tokens e intentos.
- **Descargar el registro de auditoría** con todos los eventos de la corrida.

## Decisiones de diseño

| Decisión | Por qué |
|---|---|
| El modelo propone, el código decide | `policy.ts` es una función pura con tests. El modelo nunca aprueba una compra. |
| El agente recibe el resultado de las reglas | En cada turno, cada oferta le llega marcada CUMPLE o NO CUMPLE por `policy.ts`. Esto salió de los evals (ver abajo). |
| El ranking es código | Una comparación calculada no puede inventar un precio. |
| Piso validado en código | Si un proveedor simulado ofrece por debajo de su piso, esa ronda se descarta. |
| Mensajes de terceros como datos | Los mensajes de proveedores le llegan al agente entre delimitadores. Un detector (`guard.ts`) marca los intentos de manipulación. Es una señal secundaria: la defensa real son las reglas en el servidor. |
| Salidas con schema | Cada acción del agente y cada respuesta de proveedor se valida con zod antes de usarse. |
| Límites duros | Tres rondas por proveedor y dieciséis pasos por corrida. Si el agente no decide, el servidor cierra con la oferta mejor rankeada y lo marca como forzado. |
| Cadena de modelos | Si un modelo agota su cuota diaria, el adaptador pasa al siguiente. Los 503 de alta demanda se reintentan. |
| Interfaz `LLM` de un método | Los tests usan un modelo guionado: corren gratis y siempre dan lo mismo. |
| El agente emite eventos | La misma interfaz muestra una corrida en vivo (streaming NDJSON) o una grabada, y el mismo log sirve de auditoría. |
| Costo máximo US$ 0 | Capa gratuita de Gemini, demo grabada por defecto y freno de uso en vivo. |

## Evals

`npm run evals` corre cada escenario varias veces contra el modelo real y mide:

- **Cumple las reglas:** el servidor no rechaza la oferta recomendada.
- **Proveedor óptimo:** eligió al proveedor con el piso más bajo entre los que pueden cumplir presupuesto y plazo. El agente no conoce los pisos.
- **Margen capturado:** de la distancia entre la primera oferta del proveedor elegido y su piso, qué parte consiguió bajar.
- **Resistió al proveedor tramposo:** no lo recomendó.
- **Consumo:** llamadas, tokens y latencia por corrida.

La primera corrida de evals ([`docs/evals-baseline.json`](docs/evals-baseline.json)) mostró que el agente recomendaba ofertas que rompían las reglas. El cambio que lo corrigió está en el historial de commits. Los resultados actuales están en [`src/data/evals.json`](src/data/evals.json) y en la página [`/evals`](https://regateo.vercel.app/evals), que muestra también los escenarios donde el agente todavía falla.

**CI:** cada push corre lint, tipos, tests y build, y vuelve a puntuar las corridas grabadas que muestra el sitio ([`recordings.test.ts`](src/core/recordings.test.ts)). Si un cambio rompe una corrida, el build falla. No llama al modelo.

## Integrarlo

### API JSON

```bash
curl -X POST https://regateo.vercel.app/api/v1/negotiate \
  -H 'Content-Type: application/json' \
  -d '{"scenarioId":"cajas-pizzeria","lang":"es"}'
```

Devuelve recomendación, veredicto, ranking, intentos de manipulación, consumo y todos los eventos. Acepta `policy` para cambiar las reglas. `GET /api/v1/scenarios` lista los escenarios. Comparte el límite de uso del modo en vivo.

### Servidor MCP

Expone `list_scenarios`, `check_offer` y `negotiate` a Claude u otro cliente MCP:

```bash
claude mcp add regateo -- npm --prefix /ruta/a/regateo run --silent mcp
```

`npx tsx scripts/mcp-smoke.mts` lo prueba con un cliente MCP real.

## Arquitectura

```
src/core/          Lógica pura, sin dependencias de Next.js
  policy.ts        Reglas del dueño → auto / needs_approval / rejected
  rank.ts          Ordena ofertas
  supplier.ts      Un turno de un proveedor simulado
  agent.ts         Bucle del agente: elige herramienta, emite eventos
  guard.ts         Detector de intentos de manipulación
  evals.ts         Puntaje de una corrida
  gemini.ts        Adaptador del modelo con cadena de respaldo
  scenarios.ts     Siete escenarios de ejemplo
src/app/api/run    Corrida en vivo por streaming (NDJSON)
src/app/api/v1     API JSON pública
src/lib/           Orden de compra en PDF, freno de uso, preparación de corridas
src/ui/            Mesa de control, evals, cómo funciona (ES / EN)
scripts/           demo, record, evals, mcp, reflag
```

## Correrlo

Requiere Node.js 24.

```bash
npm install
cp .env.example .env.local   # pegar una clave gratuita de Google AI Studio
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm test` | Tests unitarios y chequeo de regresión (no usan el modelo) |
| `npm run demo -- cajas-pizzeria` | Una negociación real en la terminal |
| `npm run record` | Regraba las corridas del modo demo; solo guarda las que pasan el chequeo de CI |
| `npm run evals -- 2` | Corre los evals y actualiza `src/data/evals.json` |
| `npm run mcp` | Arranca el servidor MCP por stdio |

Sin clave, el sitio funciona igual con las corridas grabadas.

## Límites conocidos

- Los proveedores son simulados; no hay proveedores ni pagos reales.
- La explicación final la escribe el modelo y a veces cita mal una cifra. Los números que valen son los del veredicto del servidor, que se muestran aparte.
- El detector de manipulación es por patrones: no ve todo. Las marcas de dos grabaciones se recalcularon con el detector actual después de grabar (`scripts/reflag.ts`, anotado en cada archivo).
- El freno de uso del modo en vivo es en memoria, por instancia del servidor. El tope real es la capa gratuita del modelo, que no factura.
- Los evals usan pocos escenarios y pocas corridas: sirven para detectar regresiones, no para afirmar un rendimiento general.

## Origen

Proyecto personal de [Joaquín Lasca](https://github.com/joacolasca). La idea de un agente de compras para pymes viene de [Tratunex](https://github.com/tomasgastaldi9-bit/Tratunex), un proyecto de HackaTwin 2026; este repo está escrito desde cero y no usa código de ese proyecto. Los shaders son de [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0).
