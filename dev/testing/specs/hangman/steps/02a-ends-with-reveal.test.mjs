// Top-down TDD step 2a (micro-step, child of 02d) for hangman. Leaf: only the last line.
// Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("when the input runs out after a guess, the last line reveals the word", () => {
  const lines = play("cat", ["c"]);
  assert.equal(lines.at(-1), "Game over. The word was cat.");
});
