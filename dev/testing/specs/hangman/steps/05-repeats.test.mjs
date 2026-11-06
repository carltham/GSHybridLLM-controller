// Top-down TDD step 5 of 6 for hangman. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("repeated guesses are pointed out and cost nothing", () => {
  assert.deepEqual(play("cat", ["c", "c", "z", "z"]), [
    "Word: _ _ _",
    "Yes! Word: c _ _",
    "You already guessed 'c'.",
    "No 'z'. Misses left: 5.",
    "You already guessed 'z'.",
    "Game over. The word was cat.",
  ]);
});
