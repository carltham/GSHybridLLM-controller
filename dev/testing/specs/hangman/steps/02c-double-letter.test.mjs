// Top-down TDD step 2c (micro-step, child of 02d) for hangman. Leaf: only the double-letter reveal.
// Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("a letter that appears twice is shown in both places", () => {
  assert.equal(play("noon", ["o"])[1], "Yes! Word: _ o o _");
});
