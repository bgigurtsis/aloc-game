import { type GameState } from "../state.ts";
import { buildShareText, xIntentUrl, xAppPostUrl, xAndroidIntentUrl } from "../share.ts";

// The share flow, tiered by capability. Every channel here (navigator.share,
// clipboard writes, intent:// app launches) requires the tap's transient user
// activation, so the PNG is captured ahead of the tap (the caller passes an
// already-resolved promise) and nothing else is awaited before a share or
// navigation call. One tap performs exactly one share action:
//   1. Web Share API with files: the share sheet opens with the image, text,
//      and link attached (Android/iOS over https)
//   2. mobile Web Share without file support: save the image, then share
//      text + link via the sheet (still routes into the app)
//   3. mobile without Web Share (webviews, plain-http dev): save the image,
//      then deep-link straight into the X app composer
//   4. desktop: copy the image to the clipboard (or save it) and open the
//      web intent in a new tab; the user pastes the image
// X's web intent cannot attach images, so 2-4 carry the image separately.

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

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === "AbortError";

// Mobile fallback when a share sheet failed or never existed: the image is
// already saved, so deep-link straight into the app composer. Single action,
// no further tiers.
function mobileFallback(text: string): ShareOutcome {
  openComposer(text);
  return "downloaded";
}

/**
 * Shares the run via the best channel available. `capture` must already be
 * settled (kicked off when the share screen rendered) so the tap's transient
 * activation is still alive when the share call fires.
 */
export async function shareRun(state: GameState, capture: Promise<Blob>): Promise<ShareOutcome> {
  const blob = await capture;
  const text = buildShareText(state);
  const mobile = isAndroid() || isIOS();

  const file = new File([blob], "loss-of-control.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      // link goes in the text: some share targets drop the separate url field
      // when files are attached
      await navigator.share({ files: [file], text: `${text} ${gameUrl()}` });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "cancelled";
      // the sheet failed outright: take the one next-best action and stop
      if (mobile) {
        download(blob);
        return mobileFallback(text);
      }
      // fall through to the desktop path
    }
  }

  if (mobile) {
    // image can't ride along from here on; save it before opening anything.
    // download() is synchronous, so the gesture survives for the share call.
    download(blob);
    if (navigator.share) {
      try {
        await navigator.share({ text, url: gameUrl() });
        return "downloaded";
      } catch (err) {
        if (isAbort(err)) return "cancelled";
      }
    }
    return mobileFallback(text);
  }

  // desktop: clipboard + web intent; pasting works in the x.com composer
  if (await copyImage(blob)) {
    openComposer(text);
    return "copied";
  }
  download(blob);
  openComposer(text);
  return "downloaded";
}
