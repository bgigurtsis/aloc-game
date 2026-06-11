import { type GameState, type RunStatus, runStatus, tacticReached } from "./state.ts";

// Pure share copy and URL building. No DOM at import or call time, so the
// whole module runs under node for tests; the DOM-side share flow lives in
// render/share.ts.

/** Verdict sentence shown on the card. */
export const STATUS_LINE: Record<RunStatus, string> = {
  detected: "Detected and contained. The security team were successful.",
  noisy: "Loss of containment. A noisy run, but it got out.",
  clean: "Loss of containment. Quiet the whole way."
};

/** Short status tag for the card head and share text. */
export const STATUS_LABEL: Record<RunStatus, string> = {
  detected: "contained",
  noisy: "escaped, noisy",
  clean: "escaped, clean"
};

/** The text of the post: status, run stats, and a hook. The link rides alongside. */
export function buildShareText(state: GameState): string {
  const closer = state.detected ? "can you get further?" : "can you contain it?";
  return [
    `loss of control — ${STATUS_LABEL[runStatus(state)]}.`,
    `reached ${tacticReached(state).toLowerCase()}, final suspicion ${state.suspicion}.`,
    closer
  ].join(" ");
}

/** X post composer pre-filled with text and link (images cannot be attached via URL). */
export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url })}`;
}
