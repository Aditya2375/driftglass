import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "node:fs";

const HTTP_PORT = 8965;
const CDP_PORT = 9366;
const SHOTS = process.env.SMOKE_SHOTS === "1";
const root = new URL("..", import.meta.url).pathname;

const profile = mkdtempSync("/tmp/driftglass-chrome-");
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    String(HTTP_PORT),
    "--bind",
    "127.0.0.1",
    "--directory",
    `${root}docs`,
  ],
  { stdio: "ignore", detached: true },
);
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

const cleanup = async (code) => {
  for (const child of [chrome, server]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    [chrome, server].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => child.once("exit", r)),
    ),
  );
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
const timeout = setTimeout(() => {
  console.error("smoke: timeout");
  cleanup(1);
}, 90000);
process.on("SIGINT", () => cleanup(2));
process.on("uncaughtException", (e) => {
  console.error(e);
  cleanup(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  cleanup(1);
});

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(
    `${ok ? "ok" : "NOT OK"} - ${name}${detail ? " - " + detail : ""}`,
  );
};

await waitFor(
  async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok,
  "chrome devtools",
);
const target = await (
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let mid = 0;
const rpcPending = new Map();
const consoleErrors = [];
const requests = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent")
    requests.push(msg.params.request.url);
  if (msg.id && rpcPending.has(msg.id)) {
    rpcPending.get(msg.id)(msg);
    rpcPending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown")
    consoleErrors.push(
      msg.params.exceptionDetails?.exception?.description ?? "page exception",
    );
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++mid;
    rpcPending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails)
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const shot = async (name) => {
  if (!SHOTS) return;
  await new Promise((r) => setTimeout(r, 900));
  const metrics = await cdp("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize;
  const r = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
  });
  writeFileSync(
    `${root}smoke-${name}.png`,
    Buffer.from(r.result.data, "base64"),
  );
};

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 960,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await waitFor(
  () => evaluate(`document.querySelectorAll('.stat').length===6`),
  "results",
);
check(
  "default 5000 paths /36 months",
  await evaluate(
    `document.getElementById('run-state').textContent==='5,000 paths / 36 steps'`,
  ),
);
check(
  "numeric view 37 rows and seven cells",
  await evaluate(
    `document.querySelectorAll('#monthly tr').length===37&&document.querySelector('#monthly tr').children.length===7`,
  ),
);
check(
  "all sample endpoints counted",
  await evaluate(
    `document.getElementById('hist-note').textContent.includes('5,000 endpoints')`,
  ),
);
check(
  "convergence all prefixes",
  await evaluate(`document.querySelectorAll('#convergence tr').length===6`),
);
check(
  "honest labels visible",
  await evaluate(
    `document.body.textContent.replace(/\\s+/g,' ').includes('not stock forecasts')&&document.body.textContent.replace(/\\s+/g,' ').includes('not a forecast interval')&&document.body.textContent.replace(/\\s+/g,' ').includes('not a 90% chance')`,
  ),
);
const applied = await evaluate(
    `document.getElementById('applied').textContent`,
  ),
  baseline = await evaluate(
    `document.querySelectorAll('.stat strong')[0].textContent`,
  ),
  before = requests.length;
await evaluate(
  `document.getElementById('drift').value='12';document.getElementById('drift').dispatchEvent(new Event('input'))`,
);
check(
  "edits do not silently apply",
  await evaluate(
    `document.getElementById('run-state').textContent.includes('edited')&&document.getElementById('applied').textContent===${JSON.stringify(applied)}`,
  ),
);
for (const [field, value] of [
  ["start", ""],
  ["start", "0x10"],
  ["start", "1e3"],
  ["start", "NaN"],
  ["start", "10001"],
  ["volatility", "81"],
  ["seed", "0"],
  ["seed", "2.5"],
  ["seed", "2147483647"],
]) {
  await evaluate(
    `document.getElementById('reset').click();document.getElementById(${JSON.stringify(field)}).value=${JSON.stringify(value)};document.getElementById('run').click()`,
  );
  check(
    `reject ${field}:${value || "blank"} preserves results`,
    await evaluate(
      `!document.getElementById('error').hidden&&document.querySelectorAll('.stat strong')[0].textContent===${JSON.stringify(baseline)}&&document.getElementById('applied').textContent===${JSON.stringify(applied)}`,
    ),
  );
}
await evaluate(
  `document.getElementById('reset').click();document.getElementById('seed').value='1730';document.getElementById('run').click()`,
);
check(
  "new seed changes sample not analytic answer",
  await evaluate(
    `document.querySelectorAll('.stat strong')[0].textContent!==${JSON.stringify(baseline)}&&document.querySelectorAll('.stat p')[0].textContent==='Exact model: 115.75'`,
  ),
);
await evaluate(
  `document.getElementById('reset').click();document.getElementById('volatility').value='0';document.getElementById('run').click()`,
);
check(
  "zero volatility coincident endpoints",
  await evaluate(
    `document.getElementById('hist-note').textContent.includes('coincide')&&document.querySelectorAll('.stat strong')[3].textContent==='0.00'`,
  ),
);
await evaluate(
  `document.getElementById('start').value='10000';document.getElementById('drift').value='30';document.getElementById('volatility').value='80';document.getElementById('months').value='120';document.getElementById('paths').value='10000';document.getElementById('seed').value='2147483646';document.getElementById('run').click()`,
);
check(
  "max parameters finite and120 months",
  await evaluate(
    `document.querySelectorAll('#monthly tr').length===121&&!document.getElementById('error').hidden===false&&!/NaN|Infinity/.test(document.getElementById('stats').textContent)`,
  ),
);
await evaluate(`document.getElementById('traces').click()`);
check(
  "traces toggle",
  await evaluate(`document.getElementById('traces').checked`),
);
await evaluate(`document.getElementById('reset').click()`);
check(
  "reset restores all controls and results",
  await evaluate(
    `document.getElementById('seed').value==='1729'&&document.getElementById('volatility').value==='25'&&!document.getElementById('traces').checked&&document.querySelectorAll('.stat strong')[0].textContent===${JSON.stringify(baseline)}`,
  ),
);
await shot("default");
for (const width of [390, 320]) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 250));
  check(
    `mobile${width} no overflow`,
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
  );
  check(
    `mobile${width} charts visible width`,
    await evaluate(
      `[...document.querySelectorAll('canvas')].every(e=>e.getBoundingClientRect().width<=innerWidth)`,
    ),
  );
  await evaluate("scrollTo(0,0)");
  await shot(`mobile-${width}`);
}
check("interactions no network", requests.length === before);
check(
  "no runtime exceptions",
  consoleErrors.length === 0,
  consoleErrors[0] ?? "",
);
check(
  "no thirdparty requests",
  requests.every((u) => u.startsWith(`http://127.0.0.1:${HTTP_PORT}/`)),
);
check(
  "error hidden at finish",
  await evaluate(`document.getElementById('error').hidden`),
);
const failures = checks.filter((x) => !x.ok);
console.log(
  `${checks.length - failures.length} passed, ${failures.length} failed`,
);
clearTimeout(timeout);
await cleanup(failures.length ? 1 : 0);
