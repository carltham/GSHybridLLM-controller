// Top-down TDD step 4 of 5 for guess-game. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("invalid input is explained and not counted as a guess", () => {
  assert.deepEqual(play(5, ["abc", "0", "5"]), [
    "Guess a number from 1 to 100.",
    "Please enter a whole number from 1 to 100.",
    "Please enter a whole number from 1 to 100.",
    "Correct! You got it in 1 guess.",
  ]);
});
