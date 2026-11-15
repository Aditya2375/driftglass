import { run } from "./model.js";
const $ = (id) => document.getElementById(id);
const defaults = {
  start: 100,
  drift: 8,
  volatility: 25,
  months: 36,
  paths: 5000,
  seed: 1729,
};
const fmt = (n) =>
  n !== 0 && Math.abs(n) < 0.01
    ? n.toPrecision(3)
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const compact = (n) =>
  n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
let result;
function values() {
  const c = {};
  for (const key of Object.keys(defaults)) {
    const s = $(key).value.trim();
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))
      throw Error(
        "Use plain decimal numbers, with no separators or exponent notation.",
      );
    c[key] = Number(s);
  }
  c.drift /= 100;
  c.volatility /= 100;
  return c;
}
function canvas(id, height) {
  const el = $(id),
    w = el.getBoundingClientRect().width,
    d = Math.min(devicePixelRatio || 1, 2);
  el.width = Math.round(w * d);
  el.height = Math.round(height * d);
  el.style.height = height + "px";
  const ctx = el.getContext("2d");
  if (!ctx) throw Error("Canvas is unavailable. Use the numeric tables below.");
  ctx.scale(d, d);
  ctx.font = "10px ui-monospace,monospace";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5e7075";
  return { ctx, w, h: height };
}
function fan() {
  if (!result) return;
  const { ctx, w, h } = canvas("fan", innerWidth <= 650 ? 310 : 360),
    l = 48,
    r = 12,
    t = 16,
    b = 32,
    rows = result.fan;
  const show = $("traces").checked;
  const max =
    1.08 *
    Math.max(
      ...rows.map((x) => Math.max(x.p95, x.exact95)),
      ...(show ? result.traces.flat() : []),
    );
  const x = (i) => l + ((w - l - r) * i) / (rows.length - 1),
    y = (v) => h - b - ((h - b - t) * v) / max;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4,
      py = y(v);
    ctx.strokeStyle = "#d8ddd5";
    ctx.beginPath();
    ctx.moveTo(l, py);
    ctx.lineTo(w - r, py);
    ctx.stroke();
    ctx.fillStyle = "#5e7075";
    ctx.textAlign = "right";
    ctx.fillText(compact(v), l - 8, py + 3);
  }
  ctx.fillStyle = "#5e7075";
  ctx.textAlign = "left";
  ctx.fillText("0", l, h - 10);
  ctx.textAlign = "right";
  ctx.fillText(`${result.config.months} months`, w - r, h - 10);
  ctx.beginPath();
  rows.forEach((v, i) =>
    i ? ctx.lineTo(x(i), y(v.p95)) : ctx.moveTo(x(i), y(v.p95)),
  );
  rows
    .slice()
    .reverse()
    .forEach((v, j) => ctx.lineTo(x(rows.length - 1 - j), y(v.p05)));
  ctx.closePath();
  ctx.fillStyle = "#ccd5f0";
  ctx.fill();
  if (show) {
    ctx.strokeStyle = "#9caaa7";
    ctx.lineWidth = 0.7;
    for (const path of result.traces) {
      ctx.beginPath();
      path.forEach((v, i) =>
        i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)),
      );
      ctx.stroke();
    }
  }
  for (const [key, color, dash] of [
    ["exact05", "#b34a29", [3, 4]],
    ["exact95", "#b34a29", [3, 4]],
    ["exactMedian", "#b34a29", [3, 4]],
    ["median", "#204ac6", []],
  ]) {
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = key === "median" ? 2 : 1;
    ctx.beginPath();
    rows.forEach((v, i) =>
      i ? ctx.lineTo(x(i), y(v[key])) : ctx.moveTo(x(i), y(v[key])),
    );
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
function histogram() {
  if (!result) return;
  const { ctx, w, h } = canvas("histogram", 280),
    l = 38,
    r = 10,
    b = 34,
    t = 18,
    logs = Array.from(result.terminals, Math.log),
    lo = Math.min(...logs),
    hi = Math.max(...logs),
    bins = 24,
    counts = new Array(bins).fill(0),
    span = hi - lo;
  for (const v of logs)
    counts[
      span === 0 ? 12 : Math.min(bins - 1, Math.floor(((v - lo) / span) * bins))
    ]++;
  const max = Math.max(...counts),
    bw = (w - l - r) / bins;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4,
      y = h - b - ((h - t - b) * i) / 4;
    ctx.strokeStyle = "#d8ddd5";
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(w - r, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillStyle = "#5e7075";
    ctx.fillText(compact(v), l - 7, y + 3);
  }
  counts.forEach((n, i) => {
    ctx.fillStyle = "#204ac6";
    const bh = ((h - t - b) * n) / max;
    ctx.fillRect(l + i * bw + 1, h - b - bh, Math.max(1, bw - 2), bh);
  });
  ctx.fillStyle = "#5e7075";
  ctx.textAlign = "left";
  ctx.fillText(compact(Math.exp(lo)), l, h - 11);
  ctx.textAlign = "right";
  ctx.fillText(compact(Math.exp(hi)), w - r, h - 11);
  $("hist-note").textContent =
    span === 0
      ? `All ${result.config.paths.toLocaleString("en-US")} terminal prices coincide (zero volatility). One central bar is shown; no price spread.`
      : `24 bins / ${result.config.paths.toLocaleString("en-US")} endpoints / minimum ${fmt(Math.exp(lo))} / maximum ${fmt(Math.exp(hi))}. The sample extremes are not model bounds.`;
}
function cell(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
function output() {
  const c = result.config,
    last = result.fan.at(-1),
    stats = $("stats");
  stats.replaceChildren();
  const cards = [
    ["Terminal median", last.median, `Exact model: ${fmt(last.exactMedian)}`],
    [
      "Central 90% range",
      null,
      `Exact: ${fmt(last.exact05)} to ${fmt(last.exact95)}`,
    ],
    ["Terminal mean", result.mean, `Exact model: ${fmt(result.exactMean)}`],
    [
      "Mean sampling noise",
      result.standardError,
      "Estimated MCSE / not a forecast interval",
    ],
    [
      "Exact mean MCSE",
      result.exactStandardError,
      "Model SD / √N / not model uncertainty",
    ],
    [
      "Mean absolute error",
      Math.abs(result.mean - result.exactMean),
      "Relative to the exact model mean",
    ],
  ];
  for (const [label, value, detail] of cards) {
    const box = document.createElement("div");
    box.className = "stat";
    box.append(
      cell("h3", label),
      cell(
        "strong",
        value === null ? `${fmt(last.p05)} to ${fmt(last.p95)}` : fmt(value),
      ),
      cell("p", detail),
    );
    stats.append(box);
  }
  $("applied").textContent =
    `APPLIED / S₀ ${fmt(c.start)} · μ ${fmt(c.drift * 100)}% · σ ${fmt(c.volatility * 100)}% · ${c.months} months · seed ${c.seed}`;
  $("run-state").textContent =
    `${c.paths.toLocaleString("en-US")} paths / ${c.months} steps`;
  const conv = $("convergence");
  conv.replaceChildren();
  for (const p of result.convergence) {
    const tr = document.createElement("tr");
    for (const v of [
      p.count.toLocaleString("en-US"),
      fmt(p.mean),
      fmt(p.standardError),
      fmt(Math.abs(p.mean - result.exactMean)),
    ])
      tr.append(cell("td", v));
    conv.append(tr);
  }
  const monthly = $("monthly");
  monthly.replaceChildren();
  result.fan.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.append(cell("th", String(i)));
    for (const k of [
      "p05",
      "median",
      "p95",
      "exact05",
      "exactMedian",
      "exact95",
    ])
      tr.append(cell("td", fmt(p[k])));
    monthly.append(tr);
  });
  draw();
}
function draw() {
  try {
    fan();
    histogram();
  } catch (e) {
    $("error").hidden = false;
    $("error").textContent =
      "Charts could not be drawn. The numeric results remain available below.";
  }
}
function calculate() {
  try {
    const c = values();
    const next = run(c);
    result = next;
    $("error").hidden = true;
    $("error").textContent = "";
    output();
  } catch (e) {
    $("error").hidden = false;
    $("error").textContent =
      `${e.message} Previous applied results remain unchanged.`;
  }
}
$("settings").addEventListener("submit", (e) => {
  e.preventDefault();
  calculate();
});
for (const key of Object.keys(defaults))
  $(key).addEventListener("input", () => {
    $("run-state").textContent = "Inputs edited / run to apply";
  });
$("reset").addEventListener("click", () => {
  for (const [key, v] of Object.entries(defaults)) $(key).value = String(v);
  $("traces").checked = false;
  calculate();
});
$("traces").addEventListener("change", draw);
let resize;
addEventListener("resize", () => {
  clearTimeout(resize);
  resize = setTimeout(draw, 100);
});
calculate();
