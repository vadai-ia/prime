// Pruebas de src/lib/domain/scoring.ts con node:test. Corre con `npm run test:domain`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCvScore, clampThreshold, normalizePsychMinimums, normalizeQuestions, normalizeWeights, slugKey, weightsTotal } from "../../src/lib/domain/scoring.ts";

test("slugKey quita acentos y símbolos", () => {
  assert.equal(slugKey("Experiencia en Cobranza (años)", "x"), "experiencia_en_cobranza_anos");
  assert.equal(slugKey("¿¡!?", "fallback"), "fallback");
});

test("normalizeWeights reparte a enteros que suman 100", () => {
  const w = normalizeWeights([
    { label: "Experiencia", weight: 1 },
    { label: "Escolaridad", weight: 1 },
    { label: "Sistemas", weight: 1 },
  ]);
  assert.equal(weightsTotal(w), 100);
  assert.deepEqual(w.map((x) => x.weight), [34, 33, 33]);
});

test("normalizeWeights escala pesos que no suman 100 y respeta proporciones", () => {
  const w = normalizeWeights([
    { label: "A", weight: 30 },
    { label: "B", weight: 30 },
    { label: "C", weight: 60 },
  ]);
  assert.deepEqual(w.map((x) => x.weight), [25, 25, 50]);
});

test("normalizeWeights descarta vacíos, ceros y claves repetidas", () => {
  const w = normalizeWeights([
    { key: "exp", label: "Experiencia", weight: 50, hint: " 2 años en cobranza " },
    { key: "exp", label: "Experiencia 2", weight: 50 },
    { label: "  ", weight: 10 },
    { label: "Cero", weight: 0 },
    { label: "NaN", weight: Number.NaN },
  ]);
  assert.deepEqual(w, [
    { key: "exp", label: "Experiencia", weight: 50, hint: "2 años en cobranza" },
    { key: "exp_2", label: "Experiencia 2", weight: 50 },
  ]);
  assert.deepEqual(normalizeWeights([]), []);
});

test("clampThreshold", () => {
  assert.equal(clampThreshold(72.4), 72);
  assert.equal(clampThreshold(140), 100);
  assert.equal(clampThreshold(-5), 0);
  assert.equal(clampThreshold(Number.NaN), 70);
});

test("normalizeQuestions numera y corrige regla y tipo desconocidos", () => {
  const q = normalizeQuestions([
    { text: "¿Qué edad tienes?", rule_key: "age_range", answer_type: "number" },
    { text: "  ", rule_key: "commute", answer_type: "text" },
    { key: "zona", text: "¿Dónde vives?", rule_key: "inventada", answer_type: "otra" },
  ]);
  assert.deepEqual(q, [
    { order: 1, key: "que_edad_tienes", text: "¿Qué edad tienes?", rule_key: "age_range", answer_type: "number" },
    { order: 2, key: "zona", text: "¿Dónde vives?", rule_key: "other", answer_type: "text" },
  ]);
});

test("normalizePsychMinimums acota y quita repetidos", () => {
  assert.deepEqual(
    normalizePsychMinimums([
      { scale: "Persuasión", min: 55.6 },
      { scale: "persuasión", min: 80 },
      { scale: "Honestidad", min: 130 },
      { scale: "", min: 10 },
    ]),
    [
      { scale: "Persuasión", min: 56 },
      { scale: "Honestidad", min: 100 },
    ],
  );
});

const WEIGHTS = [
  { key: "experience", label: "Experiencia", weight: 40 },
  { key: "education", label: "Escolaridad", weight: 30 },
  { key: "systems", label: "Sistemas", weight: 30 },
];

test("buildCvScore suma puntos acotados al peso", () => {
  const r = buildCvScore(WEIGHTS, [
    { key: "experience", points: 55, evidence: "3 años en Banco X", note: "Supera lo pedido" },
    { key: "education", points: 12.6, evidence: "", note: "" },
    { key: "systems", points: -4, evidence: "", note: "No menciona Excel" },
    { key: "inventado", points: 30, evidence: "", note: "" },
  ]);
  assert.equal(r.score, 40 + 13 + 0);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.breakdown[0], { key: "experience", label: "Experiencia", weight: 40, score: 40, note: "Supera lo pedido", evidence: "3 años en Banco X" });
  assert.deepEqual(r.breakdown[1], { key: "education", label: "Escolaridad", weight: 30, score: 13 });
});

test("buildCvScore: criterio sin evaluar vale 0 y se reporta", () => {
  const r = buildCvScore(WEIGHTS, [{ key: "experience", points: 30, evidence: "", note: "" }]);
  assert.equal(r.score, 30);
  assert.deepEqual(r.missing, ["Escolaridad", "Sistemas"]);
  assert.equal(r.breakdown[2].score, 0);
});
