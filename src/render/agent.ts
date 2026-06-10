import { makeField, hash, type FieldFn } from "./field.ts";
import { agentModel } from "./agentModel.ts";

// Glyph density ramp renderer. Pure string output from a precomputed field,
// re-thresholded per frame for breathing and flicker. Validated in the lab.

const RAMP = " .:-=+*#%@";
const W = 30;
const H = 17;
const FPS = 10;
const MAT_MS = 1100;

interface StageData {
  vals: Float32Array;
  dither: Float32Array;
}

const cache = new Map<number, StageData>();

function precompute(state: number, seed: number): StageData {
  const field: FieldFn = makeField(agentModel(state), seed);
  const vals = new Float32Array(W * H);
  const dither = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let f = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          f += field((x + 0.25 + sx * 0.5) / W, (y + 0.25 + sy * 0.5) / H);
        }
      }
      vals[i] = f / 4;
      dither[i] = (hash(x, y, state + 900) - 0.5) * 0.1;
    }
  }
  return { vals, dither };
}

function stageData(state: number): StageData {
  let d = cache.get(state);
  if (!d) {
    d = precompute(state, state * 13 + 4000);
    cache.set(state, d);
  }
  return d;
}

function distFromCentre(x: number, y: number): number {
  return Math.hypot(x - 0.5, y - 0.5) / 0.72;
}

/**
 * Renders one frame of an agent state to a string.
 * @param state structural state (0 dormant .. 6 persistence)
 * @param t seconds, for breathing
 * @param frame integer frame, for flicker
 * @param matP materialise progress 0..1 (1 = fully formed)
 */
export function renderAgent(state: number, t: number, frame: number, matP: number): string {
  const { vals, dither } = stageData(state);
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / W;
      const py = (y + 0.5) / H;
      if (matP < 1 && distFromCentre(px, py) > matP * 1.45 - 0.05) {
        row += hash(x, y, frame * 7 + 3) < 0.07 ? RAMP[1] : " ";
        continue;
      }
      const i = y * W + x;
      const breathe = 1 + 0.16 * Math.sin(t * 1.3 + px * 3.1 + py * 5.3);
      const flick = vals[i] < 0.04 ? 0 : (hash(x, y, frame & 1023) - 0.5) * 0.063;
      const v = vals[i] * breathe + flick;
      const c = Math.max(0, Math.min(0.999, v * 1.05 + dither[i]));
      row += RAMP[Math.floor(c * RAMP.length)];
    }
    rows.push(row);
  }
  return rows.join("\n");
}

export interface AgentHandle {
  stop(): void;
  setState(state: number): void;
  materialise(): void;
}

/**
 * Mounts an animated agent into a <pre>-like element. Returns a handle to
 * change state, replay the materialise, and stop. Respects reduced motion by
 * rendering the final frame once.
 */
export function mountAgent(el: HTMLElement, initialStage: number, reduced: boolean): AgentHandle {
  let state = initialStage;
  let matStart = performance.now();
  let frame = 0;
  let timer = 0;

  const draw = () => {
    const now = performance.now();
    const matP = reduced ? 1 : Math.min(1, Math.max(0, (now - matStart) / MAT_MS));
    frame++;
    el.textContent = renderAgent(state, now / 1000, frame, matP);
  };

  if (reduced) {
    draw();
  } else {
    draw();
    timer = window.setInterval(() => {
      if (!document.hidden) draw();
    }, 1000 / FPS);
  }

  return {
    stop() {
      if (timer) window.clearInterval(timer);
    },
    setState(next: number) {
      state = next;
      matStart = performance.now();
    },
    materialise() {
      matStart = performance.now();
    }
  };
}
