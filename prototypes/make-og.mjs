// Regenerates public/og.png (the social share card) by screenshotting the
// game's title screen at 1200x630 against a running dev server (npm run dev).
// Drives Chrome headless over the DevTools Protocol, same approach as
// verify-fit.mjs. Run: node prototypes/make-og.mjs
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = process.env.CHROME_PROFILE || join(tmpdir(), "aloc-og-profile");
const BASE = "http://localhost:5173";
const OUT = "public/og.png";

mkdirSync("public", { recursive: true });

const port = 9336;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${PROFILE}`,
  "about:blank"
]);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/` });
  await send("Page.bringToFront");
  await wait(1500);

  // Overlay the title and tagline using the game's own tokens, and hide the
  // interactive begin button (meaningless in a static card).
  await send("Runtime.evaluate", { expression: `(() => {
    const btn = document.querySelector("button.cta");
    if (btn) btn.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;left:0;right:0;bottom:72px;display:flex;flex-direction:column;align-items:center;gap:14px;font-family:var(--font);text-align:center;pointer-events:none;";
    const title = document.createElement("div");
    title.textContent = "LOSS OF CONTROL";
    title.style.cssText = "color:var(--accent);text-shadow:var(--glow);font-size:44px;letter-spacing:0.18em;";
    const tag = document.createElement("div");
    tag.textContent = "Play a misaligned AI agent. Six stages. Stay quiet, or get contained.";
    tag.style.cssText = "color:var(--ink);font-size:17px;letter-spacing:0.04em;";
    overlay.append(title, tag);
    document.body.append(overlay);
  })()` });
  await wait(200);

  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(data, "base64"));
  console.log(`wrote ${OUT} (1200x630)`);

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
