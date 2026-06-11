import {
  AGENT_VARIANTS,
  isAgentVariant,
  renderTextAgent,
  drawCanvasAgent,
  type AgentVariantId
} from "./agentVariants.ts";

export { AGENT_VARIANTS, type AgentVariantId } from "./agentVariants.ts";

// Mounting and animation for the agent visual. The per-variant drawing lives
// in agentVariants.ts; this module owns element creation, the 10fps stepped
// loop, the materialise reveal, and the cold-open wake pulse.

const FPS = 10;
const MAT_MS = 1100;

/** Wake pulse decay constant: visually settled after roughly 2 seconds. */
const WAKE_DECAY_MS = 700;

/**
 * Picks the visual variant for a run: random, unless overridden with an
 * `?agent=<id>` query parameter (allowlist-checked) for testing and the lab.
 */
export function pickVariant(): AgentVariantId {
  if (typeof window !== "undefined") {
    const forced = new URLSearchParams(window.location.search).get("agent");
    if (forced && isAgentVariant(forced)) return forced;
  }
  return AGENT_VARIANTS[Math.floor(Math.random() * AGENT_VARIANTS.length)];
}

export interface AgentHandle {
  stop(): void;
  setState(state: number): void;
  materialise(): void;
}

export interface MountAgentOpts {
  /** Mount already fully formed, skipping the materialise animation. */
  formed?: boolean;
  /** Play a wake pulse (amplified breathing) right after materialising. */
  wake?: boolean;
  /** Size modifier: hero for the cold open, small for the share card. */
  size?: "hero" | "small";
}

function makeAgentElement(variant: AgentVariantId, size?: "hero" | "small"): HTMLPreElement | HTMLCanvasElement {
  const mod = size ? ` ${size}` : "";
  if (variant === "canvas") {
    const c = document.createElement("canvas");
    c.className = `agent-canvas${mod}`;
    return c;
  }
  const pre = document.createElement("pre");
  pre.className = `agent ${variant}${mod}`;
  return pre;
}

// Sizes the canvas bitmap once from layout; later viewport changes just scale
// it via CSS, consistent with the rest of the app (no JS resize handling).
function initCanvas(c: HTMLCanvasElement, fallback: number): { ctx: CanvasRenderingContext2D | null; size: number } {
  const size = Math.round(c.clientWidth) || fallback;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext("2d");
  ctx?.scale(dpr, dpr);
  return { ctx, size };
}

/**
 * Mounts an animated agent into a container, creating the right inner element
 * (<pre> for text variants, <canvas> for particles). Returns a handle to
 * change state, replay the materialise, and stop. Respects reduced motion by
 * rendering the final frame once.
 */
export function mountAgent(
  container: HTMLElement,
  variant: AgentVariantId,
  initialStage: number,
  reduced: boolean,
  opts: MountAgentOpts = {}
): AgentHandle {
  let state = initialStage;
  let matStart = performance.now() - (opts.formed ? MAT_MS : 0);
  let frame = 0;
  let timer = 0;

  const node = makeAgentElement(variant, opts.size);
  container.append(node);

  let ctx: CanvasRenderingContext2D | null = null;
  let size = 0;
  if (variant === "canvas") {
    ({ ctx, size } = initCanvas(node as HTMLCanvasElement, 280));
  }

  const draw = () => {
    const now = performance.now();
    const matP = reduced ? 1 : Math.min(1, Math.max(0, (now - matStart) / MAT_MS));
    const sinceFormed = now - matStart - MAT_MS;
    const pulse = opts.wake && !reduced && sinceFormed > 0 ? Math.exp(-sinceFormed / WAKE_DECAY_MS) : 0;
    frame++;
    if (variant === "canvas") {
      // the canvas variant ignores the wake pulse; see drawCanvasAgent
      if (ctx) drawCanvasAgent(ctx, size, state, now / 1000, matP, frame);
    } else {
      node.textContent = renderTextAgent(variant, state, now / 1000, frame, matP, pulse);
    }
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

/** Share-card sized static canvas, in CSS pixels (matches .agent-canvas.small). */
const STATIC_CANVAS_SIZE = 120;

/** A fully formed, non-animated agent for the share card. */
export function renderAgentStatic(variant: AgentVariantId, state: number): HTMLElement {
  if (variant === "canvas") {
    const c = document.createElement("canvas");
    c.className = "agent-canvas small";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = STATIC_CANVAS_SIZE * dpr;
    c.height = STATIC_CANVAS_SIZE * dpr;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawCanvasAgent(ctx, STATIC_CANVAS_SIZE, state, 0, 1);
    }
    return c;
  }
  const pre = document.createElement("pre");
  pre.className = `agent ${variant} small`;
  pre.textContent = renderTextAgent(variant, state, 0, 1, 1);
  return pre;
}
