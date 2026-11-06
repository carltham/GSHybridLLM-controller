// Top-down TDD step 3 of 6 for hangman. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("guessing every letter wins", () => {
  assert.deepEqual(play("cat", ["c", "a", "t"]), [
    "Word: _ _ _",
    "Yes! Word: c _ _",
    "Yes! Word: c a _",
    "Yes! Word: c a t",
    "You win! The word was cat.",
  ]);
});
