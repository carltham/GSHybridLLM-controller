// Top-down TDD step 2b (micro-step, child of 02d) for hangman. Leaf: only the hit line.
// Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("a correct letter gives a Yes! line with the letter shown", () => {
  assert.equal(play("cat", ["c"])[1], "Yes! Word: c _ _");
});
