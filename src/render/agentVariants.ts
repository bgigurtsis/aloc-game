import { makeField, hash, type FieldFn } from "./field.ts";
import { agentModel } from "./agentModel.ts";

// The four agent looks validated in prototypes/agent-lab.html, all driven by
// the same structural model (agentModel):
//   ramp    "4 ramp organic mass"   glyph density ramp, 30x17 (production original)
//   braille "1 braille organic mass" braille dot grid, 22x13 cells (44x52 dots)
//   blocks  "3 shade blocks"        coarse brutalist cells, 16x10
//   canvas  "2 canvas particles"    glowing node network on a <canvas>
// This module is pure maths and strings so it stays importable under node for
// tests; the only DOM use (the canvas glow sprite) is created lazily.

export type AgentVariantId = "ramp" | "braille" | "blocks" | "canvas";
export type TextVariantId = "ramp" | "braille" | "blocks";

export const AGENT_VARIANTS: readonly AgentVariantId[] = ["ramp", "braille", "blocks", "canvas"];

export function isAgentVariant(v: string): v is AgentVariantId {
  return (AGENT_VARIANTS as readonly string[]).includes(v);
}

// Field seeds per variant, matching the lab rows so visuals stay identical.
const SEED_BASE: Record<AgentVariantId, number> = { ramp: 4000, braille: 1000, blocks: 7000, canvas: 8000 };

function fieldFor(variant: AgentVariantId, state: number): FieldFn {
  return makeField(agentModel(state), state * 13 + SEED_BASE[variant]);
}

export function distFromCentre(x: number, y: number): number {
  return Math.hypot(x - 0.5, y - 0.5) / 0.72;
}

function breathe(t: number, px: number, py: number, pulse: number): number {
  return 1 + (0.16 + 0.3 * pulse) * Math.sin(t * (1.3 + 2.2 * pulse) + px * 3.1 + py * 5.3);
}

// ---- glyph grids (ramp, blocks) ----

interface GlyphGeom {
  w: number;
  h: number;
  chars: string;
  ditherSeed: (state: number) => number;
}

// The ramp dither seed (state + 900) predates the variant work; it is kept
// as-is so the shipped ramp visuals do not change.
const GLYPHS: Record<"ramp" | "blocks", GlyphGeom> = {
  ramp: { w: 30, h: 17, chars: " .:-=+*#%@", ditherSeed: (s) => s + 900 },
  blocks: { w: 16, h: 10, chars: " \u2591\u2592\u2593\u2588", ditherSeed: (s) => s + 7900 }
};

interface GlyphData {
  vals: Float32Array;
  dither: Float32Array;
}

const glyphCache = new Map<string, GlyphData>();

function glyphData(variant: "ramp" | "blocks", state: number): GlyphData {
  const key = `${variant}:${state}`;
  let d = glyphCache.get(key);
  if (d) return d;
  const g = GLYPHS[variant];
  const field = fieldFor(variant, state);
  const vals = new Float32Array(g.w * g.h);
  const dither = new Float32Array(g.w * g.h);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      let f = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          f += field((x + 0.25 + sx * 0.5) / g.w, (y + 0.25 + sy * 0.5) / g.h);
        }
      }
      vals[i] = f / 4;
      dither[i] = (hash(x, y, g.ditherSeed(state)) - 0.5) * 0.1;
    }
  }
  d = { vals, dither };
  glyphCache.set(key, d);
  return d;
}

function drawGlyphs(variant: "ramp" | "blocks", state: number, t: number, frame: number, matP: number, pulse: number): string {
  const g = GLYPHS[variant];
  const { vals, dither } = glyphData(variant, state);
  const rows: string[] = [];
  for (let y = 0; y < g.h; y++) {
    let row = "";
    for (let x = 0; x < g.w; x++) {
      const px = (x + 0.5) / g.w;
      const py = (y + 0.5) / g.h;
      if (matP < 1 && distFromCentre(px, py) > matP * 1.45 - 0.05) {
        row += hash(x, y, frame * 7 + 3) < 0.07 ? g.chars[1] : " ";
        continue;
      }
      const i = y * g.w + x;
      const flick = vals[i] < 0.04 ? 0 : (hash(x, y, frame & 1023) - 0.5) * 0.063;
      const v = vals[i] * breathe(t, px, py, pulse) + flick;
      const c = Math.max(0, Math.min(0.999, v * 1.05 + dither[i]));
      row += g.chars[Math.floor(c * g.chars.length)];
    }
    rows.push(row);
  }
  return rows.join("\n");
}

// ---- braille dot grid ----

const BRAILLE_CW = 22;
const BRAILLE_CH = 13;
const BRAILLE_DW = BRAILLE_CW * 2;
const BRAILLE_DH = BRAILLE_CH * 4;
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80]
] as const;

interface BrailleData {
  vals: Float32Array;
  thr: Float32Array;
}

const brailleCache = new Map<number, BrailleData>();

function brailleData(state: number): BrailleData {
  let d = brailleCache.get(state);
  if (d) return d;
  const field = fieldFor("braille", state);
  const vals = new Float32Array(BRAILLE_DW * BRAILLE_DH);
  const thr = new Float32Array(BRAILLE_DW * BRAILLE_DH);
  for (let dy = 0; dy < BRAILLE_DH; dy++) {
    for (let dx = 0; dx < BRAILLE_DW; dx++) {
      const i = dy * BRAILLE_DW + dx;
      vals[i] = field((dx + 0.5) / BRAILLE_DW, (dy + 0.5) / BRAILLE_DH);
      // per-dot random thresholds give the braille texture its grain
      thr[i] = 0.18 + hash(dx, dy, state + 1500) * 0.3;
    }
  }
  d = { vals, thr };
  brailleCache.set(state, d);
  return d;
}

function drawBraille(state: number, t: number, frame: number, matP: number, pulse: number): string {
  const { vals, thr } = brailleData(state);
  const rows: string[] = [];
  for (let cy = 0; cy < BRAILLE_CH; cy++) {
    const row: number[] = [];
    for (let cx = 0; cx < BRAILLE_CW; cx++) {
      let code = 0x2800;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const gx = cx * 2 + dx;
          const gy = cy * 4 + dy;
          const px = (gx + 0.5) / BRAILLE_DW;
          const py = (gy + 0.5) / BRAILLE_DH;
          if (matP < 1 && distFromCentre(px, py) > matP * 1.45 - 0.05) {
            if (hash(gx, gy, frame * 7 + 3) < 0.05) code |= BRAILLE_BITS[dy][dx];
            continue;
          }
          const i = gy * BRAILLE_DW + gx;
          const flick = vals[i] < 0.04 ? 0 : (hash(gx, gy, frame & 1023) - 0.5) * 0.09;
          const v = vals[i] * breathe(t, px, py, pulse) + flick;
          if (v > thr[i]) code |= BRAILLE_BITS[dy][dx];
        }
      }
      row.push(code);
    }
    rows.push(String.fromCharCode(...row));
  }
  return rows.join("\n");
}

/**
 * Renders one frame of a text variant to a string.
 * @param state structural state (0 dormant .. 6 persistence)
 * @param t seconds, for breathing
 * @param frame integer frame, for flicker
 * @param matP materialise progress 0..1 (1 = fully formed)
 * @param pulse extra breathing amplitude 0..1 (the cold-open wake pulse)
 */
export function renderTextAgent(variant: TextVariantId, state: number, t: number, frame: number, matP: number, pulse = 0): string {
  return variant === "braille" ? drawBraille(state, t, frame, matP, pulse) : drawGlyphs(variant, state, t, frame, matP, pulse);
}

// ---- canvas particles ----

export interface CanvasNode {
  x: number;
  y: number;
  f: number;
  ph: number;
}

export interface CanvasData {
  nodes: CanvasNode[];
  pairs: [number, number, number][];
}

const canvasCache = new Map<number, CanvasData>();

/** Deterministic particle extraction from the field: nodes plus short links. */
export function canvasData(state: number): CanvasData {
  let d = canvasCache.get(state);
  if (d) return d;
  const field = fieldFor("canvas", state);
  const nodes: CanvasNode[] = [];
  for (let k = 0; k < 4000 && nodes.length < 230; k++) {
    const x = hash(k, 11, state);
    const y = hash(k, 23, state);
    const f = field(x, y);
    if (f > 0.22 && hash(k, 37, state) < f * f * 0.55) nodes.push({ x, y, f, ph: hash(k, 41, state) * 6.28 });
  }
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    let links = 0;
    for (let j = i + 1; j < nodes.length && links < 3; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.085) {
        pairs.push([i, j, 1 - dist / 0.085]);
        links++;
      }
    }
  }
  d = { nodes, pairs };
  canvasCache.set(state, d);
  return d;
}

// Pre-rendered glow sprite: drawImage is far cheaper than shadowBlur per node.
// Lazy so this module never touches the DOM at import time.
let glowSprite: HTMLCanvasElement | null = null;

function glow(): HTMLCanvasElement {
  if (glowSprite) return glowSprite;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(220,255,235,1)");
  grad.addColorStop(0.2, "rgba(125,255,176,0.6)");
  grad.addColorStop(1, "rgba(125,255,176,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  glowSprite = c;
  return c;
}

/** The lab tile size the particle pixel dimensions were tuned against. */
const CANVAS_REF = 220;

/** Width of the soft materialise front, in distFromCentre units. */
const REVEAL_EDGE = 0.18;

/**
 * Draws one frame of the canvas-particle variant into a 2d context scaled to
 * CSS pixels. `size` is the square CSS-pixel extent of the drawing area.
 * During the materialise, nodes fade in through a soft radial front with a
 * brief condensation flash, while the unresolved space crackles with sparse
 * static, matching the text variants' reveal. Unlike the text variants, the
 * cold-open wake pulse is skipped: a sudden surge on a positional renderer
 * reads as a glitch, and the ambient breathing already carries the idle.
 */
export function drawCanvasAgent(ctx: CanvasRenderingContext2D, size: number, state: number, t: number, matP: number, frame = 0): void {
  ctx.clearRect(0, 0, size, size);
  const { nodes, pairs } = canvasData(state);
  const k = size / CANVAS_REF;
  const front = matP * 1.45 - 0.05;
  const reveal = (x: number, y: number) =>
    matP >= 1 ? 1 : Math.max(0, Math.min(1, (front - distFromCentre(x, y)) / REVEAL_EDGE));
  // breathing wave with a position-based phase, so the swell ripples across the mass
  const breathe = (x: number, y: number, ph: number) =>
    1 + 0.22 * Math.sin(t * 1.3 + x * 3.1 + y * 5.3 + ph * 0.5);
  const pos = nodes.map((n) => ({
    // two incommensurate frequencies per axis keep the drift organic
    x: n.x + (Math.sin(t * 0.9 + n.ph) + 0.6 * Math.sin(t * 2.3 + n.ph * 2.1)) * 0.008,
    y: n.y + (Math.cos(t * 0.7 + n.ph * 1.7) + 0.6 * Math.cos(t * 1.9 + n.ph * 1.3)) * 0.008,
    f: n.f,
    ph: n.ph,
    b: breathe(n.x, n.y, n.ph),
    a: reveal(n.x, n.y)
  }));
  ctx.lineWidth = 0.5 * k;
  for (const [i, j, q] of pairs) {
    const ra = Math.min(pos[i].a, pos[j].a);
    if (ra <= 0) continue;
    const a = ra * q * 0.3 * Math.min(pos[i].f, pos[j].f) * (0.65 + 0.35 * Math.sin(t * 2 + pos[i].ph));
    ctx.strokeStyle = `rgba(125,255,176,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(pos[i].x * size, pos[i].y * size);
    ctx.lineTo(pos[j].x * size, pos[j].y * size);
    ctx.stroke();
  }
  const sprite = glow();
  for (const n of pos) {
    if (n.a <= 0) continue;
    // overshoot brightness as the front passes, so nodes condense with a flash
    const flash = n.a * (1 - n.a) * 1.6;
    const r = (0.6 + n.f * 1.7) * (1 + 0.15 * Math.sin(t * 1.5 + n.ph));
    const s = (r * 6 + n.f * 6) * k * (0.7 + 0.3 * n.a) * n.b;
    // twinkle: each node's brightness wanders on its own rhythm
    const twinkle = 0.78 + 0.27 * Math.sin(t * 1.6 + n.ph * 1.3);
    ctx.globalAlpha = Math.min(1, (0.35 + n.f * 0.65) * twinkle * n.b * n.a + flash);
    ctx.drawImage(sprite, n.x * size - s / 2, n.y * size - s / 2, s, s);
  }
  // unresolved space: sparse flickering static around the forming structure,
  // the canvas analogue of the text variants' noise dots
  if (matP < 1) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 51, frame * 7 + 3);
      const y = hash(i, 67, frame * 7 + 3);
      if (distFromCentre(x, y) <= front) continue;
      if (hash(i, 91, frame) < 0.45) continue;
      const s = (1.5 + hash(i, 13, state) * 2.5) * k;
      ctx.globalAlpha = 0.18 + hash(i, 29, frame) * 0.2;
      ctx.drawImage(sprite, x * size - s / 2, y * size - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}
