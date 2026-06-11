// Verifies every agent visual variant at several viewport sizes against a
// running dev server (npm run dev), driving Chrome headless over the DevTools
// Protocol like shoot.mjs (no deps). For each variant x viewport it captures
// the cold open (animated), then an agent view and the share card (under
// reduced-motion emulation so the click-through is fast), asserting on every
// stop that:
//   - the page has no horizontal overflow
//   - the agent element exists, is the right variant, and sits inside the viewport
//   - the agent actually rendered (non-blank text, or painted canvas pixels)
// Screenshots land in .shots/variants/ for manual review. Exits non-zero on
// any assertion failure.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const OUT = ".shots/variants";
mkdirSync(OUT, { recursive: true });

// optionally filter variants from the CLI: node prototypes/verify-variants.mjs canvas
const ALL_VARIANTS = ["ramp", "braille", "blocks", "canvas"];
const requested = process.argv.slice(2).filter((v) => ALL_VARIANTS.includes(v));
const VARIANTS = requested.length ? requested : ALL_VARIANTS;
const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800]
];

const port = 9334;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/aloc-verify-profile",
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

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    return r?.result?.value;
  };

  const shot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  };

  // Assertion run inside the page: overflow, agent presence/variant/bounds,
  // and proof that it actually painted something.
  const checkExpr = (variant) => `(() => {
    const doc = document.scrollingElement || document.documentElement;
    const overflowX = doc.scrollWidth - window.innerWidth;
    const agent = document.querySelector(".agent, .agent-canvas");
    if (!agent) return { ok: false, reason: "no agent element" };
    const variantOk = ${JSON.stringify(variant)} === "canvas"
      ? agent.classList.contains("agent-canvas")
      : agent.classList.contains(${JSON.stringify(variant)});
    const r = agent.getBoundingClientRect();
    const within = r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1;
    let rendered = false;
    if (agent.tagName === "CANVAS") {
      try {
        const d = agent.getContext("2d").getImageData(0, 0, agent.width, agent.height).data;
        for (let i = 3; i < d.length; i += 400) { if (d[i] > 0) { rendered = true; break; } }
      } catch { rendered = false; }
    } else {
      rendered = (agent.textContent || "").replace(/[\\s\\u2800]/g, "").length > 0;
    }
    return { ok: overflowX <= 1 && within && variantOk && rendered, overflowX, within, variantOk, rendered };
  })()`;

  // Retry for a moment: headless visibility changes can briefly stall the
  // 10fps draw interval right after navigation, leaving a transiently blank
  // canvas even though the page renders fine.
  const check = async (variant, label) => {
    let res;
    for (let attempt = 0; attempt < 10; attempt++) {
      res = await evaluate(checkExpr(variant));
      if (res?.ok) {
        console.log("  ok  ", label);
        return;
      }
      await wait(250);
    }
    failures.push(`${label}: ${JSON.stringify(res)}`);
    console.log("  FAIL", label, JSON.stringify(res));
  };

  // Click whatever advances the game: an enabled continue, else a choice.
  const stepExpr = `(() => {
    const cta = [...document.querySelectorAll("button.cta")].find((b) => !b.disabled);
    if (cta) { cta.click(); return "cta"; }
    const ch = document.querySelector("button.choice:not(.failed):not([disabled])");
    if (ch) { ch.click(); return "choice"; }
    return "none";
  })()`;

  const probeExpr = `(() => {
    if (document.querySelector(".card")) return "card";
    if (document.querySelector(".stage-caption")) return "agentview";
    return "other";
  })()`;

  const setReducedMotion = (on) =>
    send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: on ? "reduce" : "" }] });

  for (const [w, h] of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 });
    for (const variant of VARIANTS) {
      const tag = `${variant}-${w}x${h}`;
      console.log(tag);

      // 1. cold open, fully animated: materialise (1100ms) plus wake pulse.
      // bringToFront keeps the headless tab visible, otherwise document.hidden
      // pauses the agent's draw interval and the canvas stays blank.
      await setReducedMotion(false);
      await send("Page.navigate", { url: `${BASE}/?agent=${variant}` });
      await send("Page.bringToFront");
      await wait(2000);
      await check(variant, `${tag} coldopen`);
      await shot(`${tag}-coldopen`);

      // 2. click through under reduced motion (instant trajectories): capture
      //    the first agent view and the share card
      await setReducedMotion(true);
      await send("Page.navigate", { url: `${BASE}/?agent=${variant}` });
      await send("Page.bringToFront");
      await wait(600);
      let sawAgentView = false;
      let reachedCard = false;
      for (let i = 0; i < 120; i++) {
        const at = await evaluate(probeExpr);
        if (at === "agentview" && !sawAgentView) {
          sawAgentView = true;
          await check(variant, `${tag} agentview`);
          await shot(`${tag}-agentview`);
        }
        if (at === "card") {
          reachedCard = true;
          await check(variant, `${tag} sharecard`);
          await shot(`${tag}-sharecard`);
          break;
        }
        await evaluate(stepExpr);
        await wait(250);
      }
      if (!sawAgentView) failures.push(`${tag}: never reached an agent view`);
      if (!reachedCard) failures.push(`${tag}: never reached the share card`);
    }
  }

  ws.close();
  chrome.kill();

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log(`\nall variants verified across ${VIEWPORTS.length} viewports. screenshots in ${OUT}/`);
  process.exit(0);
}

run().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
