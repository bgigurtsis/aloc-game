// Deterministic field model for the agent visual. Pure maths, no DOM.
// Validated in prototypes/agent-lab.html (row "4 ramp organic mass" with the
// virus-filament treatment on replication and persistence).

export function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77) ^ Math.imul(s | 0, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export interface Blob {
  x: number;
  y: number;
  r: number;
  p: number;
  i: number;
}

export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  w: number;
  i: number;
}

export interface Model {
  blobs: Blob[];
  segs: Seg[];
  warp: number;
  rough: number;
}

function blobField(b: Blob, x: number, y: number): number {
  const dx = x - b.x;
  const dy = y - b.y;
  const d2 = (dx * dx + dy * dy) / (b.r * b.r);
  if (d2 >= 1) return 0;
  return b.i * Math.pow(1 - d2, b.p);
}

function segField(s: Seg, x: number, y: number): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((x - s.ax) * dx + (y - s.ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = s.ax + dx * t;
  const py = s.ay + dy * t;
  const ddx = x - px;
  const ddy = y - py;
  const d2 = (ddx * ddx + ddy * ddy) / (s.w * s.w);
  if (d2 >= 1) return 0;
  const q = 1 - d2;
  return s.i * q * q;
}

export type FieldFn = (x: number, y: number) => number;

export function makeField(model: Model, seed: number): FieldFn {
  return (x, y) => {
    const wx = x + (valueNoise(x * 5, y * 5, seed) - 0.5) * model.warp;
    const wy = y + (valueNoise(x * 5 + 31, y * 5 + 17, seed) - 0.5) * model.warp;
    let f = 0;
    for (const b of model.blobs) f += blobField(b, wx, wy);
    for (const s of model.segs) f += segField(s, wx, wy);
    f *= 1 + (valueNoise(x * 9, y * 9, seed + 99) - 0.5) * model.rough;
    return Math.max(0, Math.min(1.4, f));
  };
}

// ---- filament helpers (virus treatment for later stages) ----

export function filaments(
  segs: Seg[],
  x: number,
  y: number,
  angle: number,
  steps: number,
  width: number,
  seed: number,
  intensity: number
): void {
  let px = x;
  let py = y;
  let a = angle;
  let w = width;
  let i = intensity;
  for (let t = 0; t < steps; t++) {
    const nx = px + Math.cos(a) * 0.042;
    const ny = py + Math.sin(a) * 0.042;
    segs.push({ ax: px, ay: py, bx: nx, by: ny, w: Math.max(0.007, w), i });
    px = nx;
    py = ny;
    a += (hash(t, seed, 5) - 0.5) * 1.0;
    w *= 0.93;
    i *= 0.97;
    if (hash(t, seed, 9) < 0.22 && steps - t > 2) {
      filaments(segs, px, py, a + (hash(t, seed, 13) > 0.5 ? 0.9 : -0.9), Math.ceil((steps - t) * 0.6), w * 0.8, seed * 7 + t + 1, i * 0.8);
    }
  }
}

export function windingPath(
  segs: Seg[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  steps: number,
  w: number,
  i: number,
  seed: number
): void {
  let px = ax;
  let py = ay;
  for (let t = 0; t < steps; t++) {
    const u = (t + 1) / steps;
    const mid = Math.sin(u * Math.PI);
    const nx = ax + (bx - ax) * u + (valueNoise(t * 0.8, 3.3, seed) - 0.5) * 0.1 * mid;
    const ny = ay + (by - ay) * u + (valueNoise(t * 0.8, 7.7, seed) - 0.5) * 0.1 * mid;
    segs.push({ ax: px, ay: py, bx: nx, by: ny, w, i });
    px = nx;
    py = ny;
  }
}
