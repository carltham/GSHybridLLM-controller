// Top-down TDD step 2 of 5 for guess-game. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("low and high guesses get hints until the number is found", () => {
  assert.deepEqual(play(42, ["10", "80", "42"]), [
    "Guess a number from 1 to 100.",
    "Too low.",
    "Too high.",
    "Correct! You got it in 3 guesses.",
  ]);
});
