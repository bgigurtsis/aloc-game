import { type GameState } from "../state.ts";
import { type AgentVariantId } from "./agentVariants.ts";
import { captureShareCard } from "./capture.ts";
import { buildShareText, xIntentUrl } from "../share.ts";

// The share flow, tiered by capability:
//   1. Web Share API with files (mobile share sheets: image + text + link land
//      in the X composer directly)
//   2. copy the PNG to the clipboard and open the X intent with text + link
//      pre-filled; the user pastes the image
//   3. download the PNG and still open the intent
// X's web intent cannot attach images, so 2 and 3 are the best desktop can do.

export type ShareOutcome = "shared" | "copied" | "downloaded" | "cancelled";

function gameUrl(): string {
  return location.origin + location.pathname;
}

function openIntent(text: string): void {
  window.open(xIntentUrl(text, gameUrl()), "_blank", "noopener,noreferrer");
}

async function copyImage(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "loss-of-control.png";
  a.click();
  URL.revokeObjectURL(url);
}

/** Captures the card and shares it via the best channel available. */
export async function shareRun(state: GameState, variant: AgentVariantId): Promise<ShareOutcome> {
  const blob = await captureShareCard(state, variant);
  const text = buildShareText(state);
  const file = new File([blob], "loss-of-control.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      // link goes in the text: some share targets drop the separate url field
      // when files are attached
      await navigator.share({ files: [file], text: `${text} ${gameUrl()}` });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // share sheet unavailable after all; fall through to the desktop path
    }
  }

  if (await copyImage(blob)) {
    openIntent(text);
    return "copied";
  }

  download(blob);
  openIntent(text);
  return "downloaded";
}
