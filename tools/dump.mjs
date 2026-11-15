import { run } from "../web/src/model.js";
const configs = [
  [100, 0.08, 0.25, 36, 5000, 1729],
  [100, 0, 0, 12, 100, 1],
  [1, -0.2, 0.8, 120, 500, 2147483646],
  [10000, 0.3, 0.8, 120, 1000, 42],
  [50, 0.1, 0.001, 1, 777, 71],
];
console.log(
  JSON.stringify(
    configs.map(([start, drift, volatility, months, paths, seed]) => {
      const r = run({ start, drift, volatility, months, paths, seed });
      r.terminals = Array.from(r.terminals);
      return r;
    }),
  ),
);
