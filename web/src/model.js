// Original implementation; independent Java reference in src/driftglass.
export const Z95 = 1.6448536269514722;
export function validate(c) {
  if (
    !Number.isFinite(c.start) ||
    c.start < 1 ||
    c.start > 10000 ||
    !Number.isFinite(c.drift) ||
    c.drift < -0.2 ||
    c.drift > 0.3 ||
    !Number.isFinite(c.volatility) ||
    c.volatility < 0 ||
    c.volatility > 0.8 ||
    !Number.isInteger(c.months) ||
    c.months < 1 ||
    c.months > 120 ||
    !Number.isInteger(c.paths) ||
    c.paths < 100 ||
    c.paths > 10000 ||
    !Number.isInteger(c.seed) ||
    c.seed < 1 ||
    c.seed > 2147483646
  )
    throw Error("Parameters outside supported range.");
}
export function generator(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483646)
    throw Error("Invalid seed.");
  let state = seed;
  const uniform = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  return {
    uniform,
    normal: () =>
      Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()),
  };
}
export function quantile(a, p) {
  if (!a.length || !Number.isFinite(p) || p < 0 || p > 1)
    throw Error("Invalid quantile.");
  const h = (a.length - 1) * p,
    i = Math.floor(h),
    w = h - i;
  return a[i] + w * (a[Math.min(i + 1, a.length - 1)] - a[i]);
}
export const exact = (s, mu, sigma, t, z) =>
  s * Math.exp((mu - (sigma * sigma) / 2) * t + sigma * Math.sqrt(t) * z);
export function run(c) {
  validate(c);
  const rng = generator(c.seed),
    at = Array.from({ length: c.months + 1 }, () => new Float64Array(c.paths)),
    traces = Array.from({ length: 12 }, () => [c.start]);
  const convergence = [],
    checkpoints = new Set([100, 250, 500, 1000, 2500, 5000, 10000, c.paths]);
  let mean = 0,
    m2 = 0;
  for (let p = 0; p < c.paths; p++) {
    at[0][p] = c.start;
    let log = 0;
    for (let step = 1; step <= c.months; step++) {
      log +=
        (c.drift - c.volatility ** 2 / 2) / 12 +
        (c.volatility / Math.sqrt(12)) * rng.normal();
      const price = c.start * Math.exp(log);
      at[step][p] = price;
      if (p < 12) traces[p].push(price);
    }
    const x = at[c.months][p],
      d = x - mean,
      n = p + 1;
    mean += d / n;
    m2 += d * (x - mean);
    if (checkpoints.has(n))
      convergence.push({
        count: n,
        mean,
        standardError: Math.sqrt(m2 / (n - 1) / n),
      });
  }
  const terminals = at[c.months].slice();
  const fan = at.map((values, i) => {
    values.sort();
    const t = i / 12;
    return {
      time: t,
      p05: quantile(values, 0.05),
      median: quantile(values, 0.5),
      p95: quantile(values, 0.95),
      exact05: exact(c.start, c.drift, c.volatility, t, -Z95),
      exactMedian: exact(c.start, c.drift, c.volatility, t, 0),
      exact95: exact(c.start, c.drift, c.volatility, t, Z95),
    };
  });
  const t = c.months / 12,
    exactMean = c.start * Math.exp(c.drift * t),
    sampleSD = Math.sqrt(m2 / (c.paths - 1));
  return {
    config: { ...c },
    fan,
    traces,
    terminals,
    convergence,
    mean,
    sampleSD,
    standardError: sampleSD / Math.sqrt(c.paths),
    exactMean,
    exactStandardError:
      exactMean * Math.sqrt(Math.expm1(c.volatility ** 2 * t) / c.paths),
  };
}
