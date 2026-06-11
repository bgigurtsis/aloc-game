// Verifies that every screen in a full run fits inside the viewport without
// vertical scrolling, at several phone-sized viewports, against a running dev
// server (npm run dev). Drives Chrome headless over the DevTools Protocol
// (no deps), clicking through an entire run under reduced motion and asserting
// at every screen that document scrollHeight <= viewport height (and no
// horizontal overflow). Screenshots of any failing screens land in
// .shots/fit/ for review. Exits non-zero on any failure.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Chrome path and profile dir are overridable so this runs cross-platform.
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = process.env.CHROME_PROFILE || join(tmpdir(), "aloc-fit-profile");
const BASE = "http://localhost:5173";
const OUT = ".shots/fit";
mkdirSync(OUT, { recursive: true });

// S23, iPhone SE, short android, tall android
const VIEWPORTS = [
  [360, 717],
  [375, 667],
  [360, 640],
  [412, 915]
];

const port = 9335;
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

const failures = [];

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

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    return r?.result?.value;
  };

  const shot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  };

  // What screen are we on (for labelling), and does it fit?
  const measureExpr = `(() => {
    const doc = document.scrollingElement || document.documentElement;
    const h1 = document.querySelector("h1, h2");
    const label = (h1 ? h1.textContent : "")
      || (document.querySelector(".card") ? "share card" : "")
      || (document.querySelector(".globe") ? "spread map" : "")
      || (document.querySelector(".stage-caption") ? "agent view" : "")
      || "screen";
    return {
      label: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      overflowY: doc.scrollHeight - window.innerHeight,
      overflowX: doc.scrollWidth - window.innerWidth,
      atCard: !!document.querySelector(".card")
    };
  })()`;

  // Click whatever advances the game: an enabled continue, else a choice.
  const stepExpr = `(() => {
    const cta = [...document.querySelectorAll("button.cta")].find((b) => !b.disabled && b.textContent !== "[ share on x ]" && b.textContent !== "[ play again ]");
    if (cta) { cta.click(); return "cta"; }
    const ch = document.querySelector("button.choice:not(.failed):not([disabled])");
    if (ch) { ch.click(); return "choice"; }
    return "none";
  })()`;

  for (const [w, h] of VIEWPORTS) {
    const tag = `${w}x${h}`;
    console.log(tag);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: `${BASE}/` });
    await send("Page.bringToFront");
    await wait(800);

    let step = 0;
    let lastLabel = "";
    for (let i = 0; i < 160; i++) {
      const m = await evaluate(measureExpr);
      if (!m) { await wait(250); continue; }
      const name = `${tag}-${String(step).padStart(2, "0")}-${m.label}`;
      if (m.label !== lastLabel) {
        lastLabel = m.label;
        step++;
        if (m.overflowY > 1 || m.overflowX > 1) {
          failures.push(`${name}: overflowY=${m.overflowY} overflowX=${m.overflowX}`);
          console.log("  FAIL", name, `overflowY=${m.overflowY} overflowX=${m.overflowX}`);
          await shot(name);
        } else {
          console.log("  ok  ", name);
        }
      }
      if (m.atCard) break;
      await evaluate(stepExpr);
      await wait(300);
    }
    if (lastLabel !== "share-card" && !lastLabel.includes("card")) {
      const m = await evaluate(measureExpr);
      if (!m?.atCard) failures.push(`${tag}: never reached the share card (stopped at ${lastLabel})`);
    }
  }

  ws.close();
  chrome.kill();

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log(`\nall screens fit across ${VIEWPORTS.length} viewports.`);
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
