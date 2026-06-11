// One-off check for the share screen UI: auto-plays a run by clicking through
// every screen until the share card appears, screenshots it, then clicks
// [ share ] to verify the fallback hint renders.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const OUT = ".shots/capture";
mkdirSync(OUT, { recursive: true });

const port = 9335;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/aloc-share-ui-profile",
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
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: BASE + "/" });
  await wait(3500); // app load + cold-open reveal

  // click whatever advances the game until the share row appears
  for (let i = 0; i < 250; i++) {
    const { result } = await send("Runtime.evaluate", { expression: `(() => {
      if (document.querySelector(".cta-row")) return "done";
      const pick = [...document.querySelectorAll("button.choice:not(.failed), button.cta")]
        .find((b) => !b.disabled);
      if (pick) { pick.click(); return pick.textContent.slice(0, 30); }
      return "waiting";
    })()` });
    if (result.value === "done") break;
    await wait(1400);
  }

  async function shot(name) {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
    console.log("shot", name);
  }

  await shot("ui-sharecard");
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll("button.cta")].find(b => b.textContent.includes("share"))?.click()` });
  await wait(2500);
  await shot("ui-sharecard-after-click");

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
