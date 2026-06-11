import { drawCanvasAgent, renderTextAgent, type AgentVariantId } from "./agentVariants.ts";
import { stateForStageIndex } from "./agentModel.ts";
import { REGIONS } from "./globe.ts";
import { type GameState, runStatus, tacticReached } from "../state.ts";
import { STATUS_LINE, STATUS_LABEL } from "../share.ts";

// Renders the share card to a PNG by drawing it directly onto an offscreen
// canvas: a fixed-size, deterministic mirror of the DOM card in sharecard.ts.
// No html-to-image dependency, no CSS-capture quirks.

const W = 600;
const SCALE = 2; // 1200px wide PNG, crisp in the X composer
const PAD = 36;
const GAP = 26;
const ART = 264; // square extent for the canvas-particle variant
const TEXT_ART_W = 280; // target width for the text variants

// Mirrors tokens.css with --alert at 0 (the share screen never tints red).
const COLOR = {
  bg: "#060c08",
  border: "hsl(145 45% 42%)",
  accent: "hsl(145 100% 74%)",
  glow: "hsl(145 100% 74% / 0.55)",
  ink: "#9ab0a4",
  dim: "#5a6e63",
  line: "#0d1812"
};

const FONT_STACK = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

function font(px: number, weight = 400): string {
  return `${weight} ${px}px ${FONT_STACK}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Stat {
  value: string;
  label: string;
}

function statsFor(state: GameState): Stat[] {
  const stats: Stat[] = [
    { value: tacticReached(state), label: "tactic reached" },
    { value: String(state.suspicion), label: "final suspicion" }
  ];
  if (!state.detected) stats.push({ value: String(REGIONS.length), label: "regions reached" });
  return stats;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("share card capture failed"))), "image/png");
  });
}

/** Draws the run's share card to a PNG blob. */
export async function captureShareCard(state: GameState, variant: AgentVariantId): Promise<Blob> {
  // The font is already in use on the page; this just avoids racing its load.
  await document.fonts.ready.catch(() => undefined);

  const status = runStatus(state);
  const stage = state.detected ? stateForStageIndex(state.stageIndex) : 6;

  const scratch = document.createElement("canvas").getContext("2d");
  if (!scratch) throw new Error("canvas unavailable");

  // --- measure ---
  let artLines: string[] = [];
  let artFont = 0;
  let artH = ART;
  if (variant !== "canvas") {
    artLines = renderTextAgent(variant, stage, 0, 1, 1).split("\n");
    scratch.font = font(10);
    const charRatio = scratch.measureText("M").width / 10; // mono advance per font px
    artFont = Math.floor(TEXT_ART_W / (artLines[0].length * charRatio));
    artH = artLines.length * artFont;
  }

  const stats = statsFor(state);
  const statRows = Math.ceil(stats.length / 2);
  const STAT_H = 42;
  const statsH = statRows * STAT_H + (statRows - 1) * 6;

  scratch.font = font(15);
  const verdictLines = wrap(scratch, STATUS_LINE[status], W - PAD * 2);
  const VERDICT_LH = 23;
  const verdictH = 16 + verdictLines.length * VERDICT_LH; // border gap + lines

  const headH = 14;
  const urlH = 13;
  const H = Math.round(PAD + headH + GAP + artH + GAP + statsH + GAP + verdictH + 18 + urlH + PAD);

  // --- draw ---
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  ctx.textBaseline = "top";
  let y = PAD;

  // head row
  ctx.font = font(13);
  ctx.fillStyle = COLOR.dim;
  ctx.fillText("LOSS OF CONTROL", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(STATUS_LABEL[status].toUpperCase(), W - PAD, y);
  ctx.textAlign = "left";
  y += headH + GAP;

  // agent art
  if (variant === "canvas") {
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = ART * SCALE;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.scale(SCALE, SCALE);
      drawCanvasAgent(tctx, ART, stage, 0, 1);
      ctx.drawImage(tmp, (W - ART) / 2, y, ART, ART);
    }
  } else {
    ctx.font = font(artFont);
    ctx.fillStyle = COLOR.accent;
    ctx.shadowColor = COLOR.glow;
    ctx.shadowBlur = 6;
    ctx.textAlign = "center";
    for (let i = 0; i < artLines.length; i++) {
      ctx.fillText(artLines[i], W / 2, y + i * artFont);
    }
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
  }
  y += artH + GAP;

  // stats grid, two columns
  const colW = (W - PAD * 2) / 2;
  for (let i = 0; i < stats.length; i++) {
    const x = PAD + (i % 2) * colW;
    const cy = y + Math.floor(i / 2) * (STAT_H + 6);
    ctx.font = font(17, 500);
    ctx.fillStyle = COLOR.accent;
    ctx.fillText(stats[i].value, x, cy);
    ctx.font = font(13);
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(stats[i].label, x, cy + 24);
  }
  y += statsH + GAP;

  // verdict, under a hairline
  ctx.strokeStyle = COLOR.line;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 0.5);
  ctx.lineTo(W - PAD, y + 0.5);
  ctx.stroke();
  y += 16;
  ctx.font = font(15);
  ctx.fillStyle = COLOR.ink;
  for (const line of verdictLines) {
    ctx.fillText(line, PAD, y);
    y += VERDICT_LH;
  }
  y += 18;

  // url line
  ctx.font = font(12);
  ctx.fillStyle = COLOR.dim;
  ctx.fillText("play it yourself \u00b7 offpolicy.bot", PAD, y);

  return toBlob(canvas);
}
