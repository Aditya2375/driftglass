import { execFileSync } from "node:child_process";
import { run, generator, quantile } from "../web/src/model.js";
const configs = [
  [100, 0.08, 0.25, 36, 5000, 1729],
  [100, 0, 0, 12, 100, 1],
  [1, -0.2, 0.8, 120, 500, 2147483646],
  [10000, 0.3, 0.8, 120, 1000, 42],
  [50, 0.1, 0.001, 1, 777, 71],
];
const expected = execFileSync(
  process.env.JAVA || "java",
  ["-cp", "build/classes", "Dump"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\s+/)
  .map(Number);
let at = 0,
  max = 0;
function compare(x) {
  const e = expected[at++],
    error = Math.abs(x - e) / Math.max(1, Math.abs(x), Math.abs(e));
  max = Math.max(max, error);
  if (!Number.isFinite(x) || !Number.isFinite(e) || error > 1e-11)
    throw Error(`Mismatch at ${at}: ${x} vs ${e}`);
}
for (const [start, drift, volatility, months, paths, seed] of configs) {
  const r = run({ start, drift, volatility, months, paths, seed });
  [
    r.mean,
    r.sampleSD,
    r.standardError,
    r.exactMean,
    r.exactStandardError,
  ].forEach(compare);
  for (const v of r.fan) Object.values(v).forEach(compare);
  r.traces.flat().forEach(compare);
  r.terminals.forEach(compare);
  for (const p of r.convergence) Object.values(p).forEach(compare);
}
if (at !== expected.length) throw Error("Length mismatch");
const g = generator(1);
if (
  Math.round(g.uniform() * 2147483647) !== 16807 ||
  Math.round(g.uniform() * 2147483647) !== 282475249
)
  throw Error("PRNG golden mismatch");
if (quantile([0, 10], 0.05) !== 0.5) throw Error("Quantile mismatch");
console.log(`${at} Java/JS values compared; max relative error ${max}`);
