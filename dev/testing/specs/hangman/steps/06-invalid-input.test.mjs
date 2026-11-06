// Top-down TDD step 6 of 6 for hangman. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("invalid input is explained and uppercase letters are accepted", () => {
  assert.deepEqual(play("cat", ["", "ab", "1", "C"]), [
    "Word: _ _ _",
    "Please enter one letter.",
    "Please enter one letter.",
    "Please enter one letter.",
    "Yes! Word: c _ _",
    "Game over. The word was cat.",
  ]);
});
