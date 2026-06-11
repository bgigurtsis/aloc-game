import { test } from "node:test";
import assert from "node:assert/strict";

// The variant renderers are pure maths and strings (no DOM at import time),
// so they run directly under node via strip-types, like the reducer tests.
const { AGENT_VARIANTS, isAgentVariant, renderTextAgent, canvasData } = await import("../src/render/agentVariants.ts");

const STATES = [0, 1, 2, 3, 4, 5, 6];

// expected character grid per text variant: [columns, rows]
const DIMS = {
  ramp: [30, 17],
  braille: [22, 13],
  blocks: [16, 10]
};

// characters that count as "empty" in a frame (braille blank is U+2800)
const BLANK = /[\s\u2800]/g;

test("the variant pool holds the four lab styles", () => {
  assert.deepEqual([...AGENT_VARIANTS], ["ramp", "braille", "blocks", "canvas"]);
  for (const v of AGENT_VARIANTS) assert.ok(isAgentVariant(v));
  assert.equal(isAgentVariant("swarm"), false);
  assert.equal(isAgentVariant(""), false);
});

test("text variants render the exact grid at every state", () => {
  for (const [variant, [w, h]] of Object.entries(DIMS)) {
    for (const state of STATES) {
      const rows = renderTextAgent(variant, state, 0, 1, 1).split("\n");
      assert.equal(rows.length, h, `${variant} state ${state} row count`);
      for (const row of rows) assert.equal(row.length, w, `${variant} state ${state} row width`);
    }
  }
});

test("formed frames are non-empty for every variant and state", () => {
  for (const variant of Object.keys(DIMS)) {
    for (const state of STATES) {
      const frame = renderTextAgent(variant, state, 0, 1, 1);
      const ink = frame.replace(BLANK, "").length;
      assert.ok(ink > 0, `${variant} state ${state} rendered blank`);
    }
  }
});

test("text rendering is deterministic for fixed inputs", () => {
  for (const variant of Object.keys(DIMS)) {
    const a = renderTextAgent(variant, 3, 1.5, 7, 1, 0.4);
    const b = renderTextAgent(variant, 3, 1.5, 7, 1, 0.4);
    assert.equal(a, b);
  }
});

test("mid-materialise frames stay on the same grid", () => {
  for (const [variant, [w, h]] of Object.entries(DIMS)) {
    const rows = renderTextAgent(variant, 0, 0.3, 3, 0.4).split("\n");
    assert.equal(rows.length, h);
    for (const row of rows) assert.equal(row.length, w);
  }
});

test("canvas particle extraction is populated and bounded at every state", () => {
  for (const state of STATES) {
    const { nodes, pairs } = canvasData(state);
    assert.ok(nodes.length > 10, `state ${state} too sparse (${nodes.length} nodes)`);
    assert.ok(nodes.length <= 230, `state ${state} over the node cap`);
    for (const n of nodes) {
      assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, `state ${state} node out of bounds`);
      assert.ok(n.f > 0, `state ${state} node without field value`);
    }
    for (const [i, j, q] of pairs) {
      assert.ok(i >= 0 && i < nodes.length && j >= 0 && j < nodes.length, `state ${state} pair index out of range`);
      assert.ok(q > 0 && q <= 1, `state ${state} pair weight out of range`);
    }
  }
});
