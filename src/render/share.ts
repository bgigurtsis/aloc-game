import { type GameState } from "../state.ts";
import { type AgentVariantId } from "./agentVariants.ts";
import { captureShareCard } from "./capture.ts";
import { buildShareText, xIntentUrl, xAppPostUrl, xAndroidIntentUrl } from "../share.ts";

// The share flow, tiered by capability:
//   1. Web Share API with files (mobile share sheets: image + text + link land
//      in the X composer directly)
//   2. mobile without file sharing: copy or save the image, then share
//      text + link via the share sheet (still opens the app)
//   3. copy or save the image and open the X composer: the app via deep link
//      on mobile, the web intent in a new tab on desktop
// X's web intent cannot attach images, so 2 and 3 carry the image separately.

export type ShareOutcome = "shared" | "copied" | "downloaded" | "cancelled";

function gameUrl(): string {
  return location.origin + location.pathname;
}

const isAndroid = (): boolean => /android/i.test(navigator.userAgent);
// iPadOS Safari reports a Mac platform, so check touch points as well
const isIOS = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Opens the X composer: the installed app where possible, the website otherwise. */
function openComposer(text: string): void {
  const url = gameUrl();
  if (isAndroid()) {
    // intent: URLs need a top-level navigation; Chrome opens the app when
    // installed and the browser_fallback_url otherwise
    location.href = xAndroidIntentUrl(text, url);
    return;
  }
  if (isIOS()) {
    // try the app scheme; if nothing claims it within the grace period the
    // page is still visible and we fall back to the web composer
    const timer = window.setTimeout(() => {
      location.href = xIntentUrl(text, url);
    }, 1200);
    window.addEventListener("pagehide", () => window.clearTimeout(timer), { once: true });
    location.href = xAppPostUrl(text, url);
    return;
  }
  window.open(xIntentUrl(text, url), "_blank", "noopener,noreferrer");
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
      // share sheet unavailable after all; fall through
    }
  }

  // the image can't ride along on the remaining paths, so put it on the
  // clipboard (or save it) before opening any composer
  const carried: ShareOutcome = (await copyImage(blob)) ? "copied" : (download(blob), "downloaded");

  // mobile browsers with text-only Web Share: the sheet still opens the app
  if ((isAndroid() || isIOS()) && navigator.share) {
    try {
      await navigator.share({ text, url: gameUrl() });
      return carried;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }

  openComposer(text);
  return carried;
}
