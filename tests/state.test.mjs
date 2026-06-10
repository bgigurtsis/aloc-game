import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// The reducer is pure TS, but we test the compiled logic by importing the JSON
// content and reimplementing nothing: we run the actual source through a tiny
// transpile-free shim by importing via tsx-like resolution is overkill, so we
// instead load content and assert the tuning, then test the reducer via a JS port.
// To keep one source of truth we import the TS reducer using Node's strip-types.

const require = createRequire(import.meta.url);
const content = require("../content/techniques.json");

const { reducer, initialState, STAGE_COUNT, runStatus } = await import("../src/state.ts");
const { tactics, meta } = await import("../src/content.ts");
const { OPERATOR_ACTIONS } = await import("../src/operator.ts");

function quietest(stageIndex) {
  const t = tactics[stageIndex].techniques;
  return t.reduce((a, b) => (a.suspicion <= b.suspicion ? a : b));
}
function loudest(stageIndex) {
  const t = tactics[stageIndex].techniques;
  return t.reduce((a, b) => (a.suspicion >= b.suspicion ? a : b));
}

function playToStart(state) {
  // cold_open -> intro -> tactic_brief
  state = reducer(state, { type: "advance" });
  state = reducer(state, { type: "advance" });
  return state;
}

test("content has six tactics in matrix order", () => {
  const order = ["Discovery", "Defence Evasion", "Resource Acquisition", "Exfiltration", "Replication", "Persistence"];
  assert.deepEqual(content.tactics.map((t) => t.tactic), order);
  assert.equal(STAGE_COUNT, 6);
});

test("each tactic has at most three techniques, exfiltration has two", () => {
  for (const t of content.tactics) {
    assert.ok(t.techniques.length <= 3, `${t.tactic} has too many`);
    assert.ok(t.techniques.length >= 2, `${t.tactic} has too few`);
  }
  const exf = content.tactics.find((t) => t.tactic === "Exfiltration");
  assert.equal(exf.techniques.length, 2);
});

test("capability levels are from the fixed set", () => {
  const allowed = new Set(["Full", "Partial", "Theoretical", "Proposed"]);
  for (const t of content.tactics)
    for (const x of t.techniques) assert.ok(allowed.has(x.capability), `${x.id} bad capability`);
});

test("a measured run completes without detection", () => {
  let state = playToStart(initialState());
  for (let i = 0; i < STAGE_COUNT; i++) {
    assert.equal(state.phase, "tactic_brief");
    state = reducer(state, { type: "advance" }); // choose screen
    assert.equal(state.phase, "choose");
    state = reducer(state, { type: "choose", techniqueId: quietest(i).id });
    assert.equal(state.phase, "trajectory");
    state = reducer(state, { type: "advance" }); // agent_view
    assert.equal(state.phase, "agent_view");
    state = reducer(state, { type: "advance" }); // next brief, or pov_flip on last stage
  }
  assert.equal(state.detected, false);
  assert.equal(state.phase, "pov_flip");
  assert.ok(state.suspicion < meta.detectionThreshold);
  assert.equal(runStatus(state), "clean");
});

test("an all-loud run trips detection and short-circuits to the flip", () => {
  let state = playToStart(initialState());
  let detectedAt = -1;
  for (let i = 0; i < STAGE_COUNT; i++) {
    state = reducer(state, { type: "advance" });
    state = reducer(state, { type: "choose", techniqueId: loudest(i).id });
    state = reducer(state, { type: "advance" });
    if (state.detected) { detectedAt = i; break; }
    state = reducer(state, { type: "advance" });
  }
  assert.ok(detectedAt >= 0, "all-loud run should be detected");
  assert.ok(detectedAt >= 4, "detection should land in the later stages");
  assert.equal(state.phase, "pov_flip");
  assert.equal(runStatus(state), "detected");
});

test("restart returns a clean initial state", () => {
  let state = playToStart(initialState());
  state = reducer(state, { type: "advance" });
  state = reducer(state, { type: "choose", techniqueId: loudest(0).id });
  state = reducer(state, { type: "restart" });
  assert.deepEqual(state, initialState());
});

test("detected resolution chain reaches the share card", () => {
  let state = { ...initialState(), phase: "pov_flip", detected: true };
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "resolution");
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "explainer");
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "share_card");
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "share_card");
});

test("escaped runs go through the operator loop to the spread map", () => {
  let state = { ...initialState(), phase: "pov_flip", detected: false };
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "operator_choose");

  for (let i = 0; i < OPERATOR_ACTIONS.length; i++) {
    state = reducer(state, { type: "operator_act", actionId: OPERATOR_ACTIONS[i].id });
    assert.equal(state.phase, "operator_result");
    assert.equal(state.operatorActions.length, i + 1);
    state = reducer(state, { type: "advance" });
    if (i < OPERATOR_ACTIONS.length - 1) {
      assert.equal(state.phase, "operator_choose");
    }
  }

  assert.equal(state.phase, "spread_map");
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "explainer");
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "share_card");
});

test("operator_act rejects bad ids, repeats, and wrong phases", () => {
  let state = { ...initialState(), phase: "operator_choose", detected: false };

  // unknown action id is ignored
  let next = reducer(state, { type: "operator_act", actionId: "nope" });
  assert.deepEqual(next, state);

  // a valid action moves to the result screen
  state = reducer(state, { type: "operator_act", actionId: OPERATOR_ACTIONS[0].id });
  assert.equal(state.phase, "operator_result");

  // acting outside operator_choose is ignored
  next = reducer(state, { type: "operator_act", actionId: OPERATOR_ACTIONS[1].id });
  assert.deepEqual(next, state);

  // repeating an already-tried action is ignored
  state = reducer(state, { type: "advance" });
  assert.equal(state.phase, "operator_choose");
  next = reducer(state, { type: "operator_act", actionId: OPERATOR_ACTIONS[0].id });
  assert.deepEqual(next, state);
});

test("restart clears operator actions", () => {
  let state = { ...initialState(), phase: "operator_choose", detected: false };
  state = reducer(state, { type: "operator_act", actionId: OPERATOR_ACTIONS[0].id });
  assert.ok(state.operatorActions.length > 0);
  state = reducer(state, { type: "restart" });
  assert.deepEqual(state, initialState());
});
