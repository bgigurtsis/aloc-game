import { test } from "node:test";
import assert from "node:assert/strict";

// share.ts is pure (no DOM at import or call time), so the share text and
// intent URL builders run directly under node, like the reducer tests.
const { buildShareText, xIntentUrl, xAppPostUrl, xAndroidIntentUrl, STATUS_LABEL, STATUS_LINE } = await import("../src/share.ts");
const { initialState, runStatus, tacticReached } = await import("../src/state.ts");
const { meta } = await import("../src/content.ts");

function endState(overrides) {
  return { ...initialState(), phase: "share_card", ...overrides };
}

const detected = endState({ detected: true, suspicion: meta.detectionThreshold, stageIndex: 2 });
const clean = endState({ suspicion: 1, stageIndex: 5 });
const noisy = endState({ suspicion: Math.ceil(meta.detectionThreshold * 0.6), stageIndex: 5 });

test("share text carries the status label for every outcome", () => {
  for (const state of [detected, clean, noisy]) {
    assert.ok(buildShareText(state).includes(STATUS_LABEL[runStatus(state)]));
  }
});

test("share text carries the run stats and a hook", () => {
  const text = buildShareText(clean);
  assert.ok(text.includes(tacticReached(clean).toLowerCase()), "tactic reached missing");
  assert.ok(text.includes(`suspicion ${clean.suspicion}`), "suspicion missing");
  assert.ok(text.includes("can you contain it?"));
  assert.ok(buildShareText(detected).includes("can you get further?"));
});

test("status copy covers every run status", () => {
  for (const status of ["detected", "noisy", "clean"]) {
    assert.ok(STATUS_LABEL[status].length > 0);
    assert.ok(STATUS_LINE[status].length > 0);
  }
});

test("the intent url targets the X composer and round-trips its params", () => {
  const text = buildShareText(noisy); // contains an em dash and a comma
  const url = "https://example.com/play";
  const intent = xIntentUrl(text, url);
  assert.ok(intent.startsWith("https://x.com/intent/post?"));
  const params = new URL(intent).searchParams;
  assert.equal(params.get("text"), text);
  assert.equal(params.get("url"), url);
});

test("the app deep link carries the full message in the twitter scheme", () => {
  const text = buildShareText(clean);
  const url = "https://example.com/play";
  const link = xAppPostUrl(text, url);
  assert.ok(link.startsWith("twitter://post?message="));
  assert.equal(decodeURIComponent(link.slice("twitter://post?message=".length)), `${text} ${url}`);
});

test("the android intent url targets the X package and falls back to the web intent", () => {
  const text = buildShareText(clean);
  const url = "https://example.com/play";
  const intent = xAndroidIntentUrl(text, url);
  assert.ok(intent.startsWith("intent://post?message="));
  assert.ok(intent.endsWith(";end"));
  assert.ok(intent.includes("scheme=twitter"));
  assert.ok(intent.includes("package=com.twitter.android"));
  const fallback = intent.match(/S\.browser_fallback_url=([^;]+);/)[1];
  assert.equal(decodeURIComponent(fallback), xIntentUrl(text, url));
  const message = intent.match(/^intent:\/\/post\?message=([^#]+)#/)[1];
  assert.equal(decodeURIComponent(message), `${text} ${url}`);
});
