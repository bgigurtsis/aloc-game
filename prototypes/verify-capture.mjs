// One-off check for the share-card PNG capture: drives the dev server with
// headless Chrome (CDP, no deps) and calls captureShareCard for each agent
// variant and both run outcomes, saving the PNGs for visual inspection.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const OUT = ".shots/capture";
mkdirSync(OUT, { recursive: true });

const port = 9334;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/aloc-capture-profile",
  "about:blank"
]);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function rpc() {
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
  const ws = new WebSocket(await rpc());
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  await send("Page.enable");
  await send("Page.navigate", { url: BASE + "/" });
  await wait(2000); // app + font load

  const cases = [];
  for (const variant of ["ramp", "braille", "blocks", "canvas"]) {
    cases.push([`${variant}-escaped`, variant, { detected: false, stageIndex: 5, suspicion: 12 }]);
  }
  cases.push(["ramp-detected", "ramp", { detected: true, stageIndex: 2, suspicion: 80 }]);

  for (const [name, variant, partial] of cases) {
    const expr = `(async () => {
      const { captureShareCard } = await import("/src/render/capture.ts");
      const state = { phase: "share_card", choices: [], lastDelta: 0, operatorActions: [], ...${JSON.stringify(partial)} };
      const blob = await captureShareCard(state, ${JSON.stringify(variant)});
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin);
    })()`;
    const res = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      console.error(name, "FAILED:", res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
      continue;
    }
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(res.result.value, "base64"));
    console.log("captured", name);
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
