// Smoke test: run the agent-lab page script with DOM stubs and report errors.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./agent-lab.html", import.meta.url), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no script block found"); process.exit(1); }

const made = [];
function el() {
  const e = {
    style: {}, className: "", textContent: "", innerHTML: "",
    width: 0, height: 0,
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    getContext() {
      const chain = new Proxy(function () {}, {
        get: () => chain,
        set: () => true,
        apply: () => chain
      });
      return chain;
    }
  };
  made.push(e);
  return e;
}

const documentStub = {
  createElement: () => el(),
  getElementById: () => el()
};
const windowStub = { matchMedia: () => ({ matches: false }) };

let frames = 0;
class IOStub {
  observe() {}
  disconnect() {}
}

const fn = new Function(
  "document", "window", "setInterval", "performance", "IntersectionObserver",
  m[1] + "\n;return { tiles, OPTIONS, STAGES, drawBraille, drawGlyphs, GEOM };"
);
const api = fn(documentStub, windowStub, (cb) => { /* run a few extra frames manually */ for (let i = 0; i < 3; i++) cb(); }, performance, IOStub);

console.log("tiles built:", api.tiles.length, "(expect", api.OPTIONS.length * 8 + ")");

// force-complete materialise and render every tile once, checking output shape
const past = performance.now() - 5000;
for (const t of api.tiles) t.matStart = past;

let textTiles = 0, nonEmpty = 0;
for (const tile of api.tiles) {
  if (tile.opt.type === "canvas") continue;
  textTiles++;
  const data = tile.stageData[tile.stage];
  const out = tile.opt.type === "braille"
    ? api.drawBraille(data, 1.0, 5, tile.phase, 1)
    : api.drawGlyphs(data, api.GEOM[tile.opt.type].chars, 1.0, 5, tile.phase, 1);
  const lines = out.split("\n").slice(0, -1); // drop trailing empty from final newline
  const expectH = tile.opt.type === "braille" ? 13 : api.GEOM[tile.opt.type].H;
  if (lines.length !== expectH) {
    console.error("BAD line count", tile.opt.name, "stage", tile.stage, lines.length, "vs", expectH);
    process.exit(1);
  }
  const ink = out.replace(/[\s\u2800]/g, "");
  if (ink.length > 3) nonEmpty++;
}
console.log("text tiles:", textTiles, "with visible structure:", nonEmpty);
if (nonEmpty < textTiles * 0.9) {
  console.error("too many empty renders, tuning problem");
  process.exit(1);
}
console.log("smoke test passed");
