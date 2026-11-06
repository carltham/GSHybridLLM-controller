// Top-down TDD step 3 of 5 for guess-game. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("a first-try win uses the singular 'guess'", () => {
  assert.deepEqual(play(7, ["7"]), ["Guess a number from 1 to 100.", "Correct! You got it in 1 guess."]);
});

test("running out of input after a hint reveals the number", () => {
  assert.deepEqual(play(60, ["20"]), ["Guess a number from 1 to 100.", "Too low.", "Game over. The number was 60."]);
});
