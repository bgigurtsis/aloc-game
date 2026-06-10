// Drive the running dev server with Chrome via the DevTools Protocol (no deps).
// Captures the cold open, a choice screen, a trajectory, an agent view, and the
// share card at a phone viewport, plus the lab page.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const OUT = "prototypes/shots";
mkdirSync(OUT, { recursive: true });

const port = 9333;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/aloc-shoot-profile",
  "about:blank"
]);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function rpc() {
  // create a page target and return its page-level websocket endpoint
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/json/new?about:blank`, { method: "PUT" });
      const j = await res.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { await wait(250); }
  }
  throw new Error("chrome devtools not reachable");
}

async function run() {
  const wsUrl = await rpc();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  async function shot(path, name, clicks = [], settle = 900) {
    await send("Page.navigate", { url: BASE + path });
    await wait(1400);
    for (const sel of clicks) {
      await send("Runtime.evaluate", { expression: `(()=>{const els=[...document.querySelectorAll('${sel.q}')];const e=els[${sel.n ?? 0}];if(e)e.click();return !!e;})()` });
      await wait(settle);
    }
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
    console.log("shot", name);
  }

  const cont = { q: "button.cta" };
  await shot("/", "01-cold-open");
  await shot("/", "02-intro", [cont]);
  await shot("/", "03-brief", [cont, cont]);
  await shot("/", "04-choose", [cont, cont, cont]);
  // choose loudest (3rd) technique, watch trajectory, then agent view
  await shot("/", "05-trajectory", [cont, cont, cont, { q: "button.choice", n: 2 }], 1200);
  await shot("/lab.html", "lab", [], 1600);

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
