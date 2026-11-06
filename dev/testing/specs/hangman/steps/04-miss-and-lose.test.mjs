// Top-down TDD step 4 of 6 for hangman. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("a wrong letter costs one miss", () => {
  assert.deepEqual(play("cat", ["z"]), ["Word: _ _ _", "No 'z'. Misses left: 5.", "Game over. The word was cat."]);
});

test("the player loses when misses run out, and later input is ignored", () => {
  assert.deepEqual(play("cat", ["x", "y", "c"], 2), [
    "Word: _ _ _",
    "No 'x'. Misses left: 1.",
    "No 'y'. Misses left: 0.",
    "You lose! The word was cat.",
  ]);
});
