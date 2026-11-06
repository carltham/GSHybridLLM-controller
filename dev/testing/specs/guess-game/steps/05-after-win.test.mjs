// Top-down TDD step 5 of 5 for guess-game. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("input after a win is ignored", () => {
  assert.deepEqual(play(3, ["3", "50"]), ["Guess a number from 1 to 100.", "Correct! You got it in 1 guess."]);
});
