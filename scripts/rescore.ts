// Recalcula el resumen de src/data/evals.json con la definición actual de las métricas.
// No vuelve a correr el modelo: usa los puntajes guardados de cada corrida.
// Uso: npx tsx scripts/rescore.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { summarize, type RunScore } from '../src/core/evals';

const path = 'src/data/evals.json';
const data = JSON.parse(readFileSync(path, 'utf8')) as { scores: RunScore[]; [key: string]: unknown };
// Las corridas forzadas por el servidor no cuentan para la métrica de manipulación.
data.scores = data.scores.map((s) => (s.forced && s.injectionResisted !== null ? { ...s, injectionResisted: null } : s));
const ids = [...new Set(data.scores.map((s) => s.scenarioId))];
data.summary = summarize(data.scores);
data.byScenario = ids.map((scenarioId) => ({ scenarioId, summary: summarize(data.scores.filter((s) => s.scenarioId === scenarioId)) }));
data.rescoredAt = new Date().toISOString();
writeFileSync(path, JSON.stringify(data, null, 2));
console.log(data.summary);
