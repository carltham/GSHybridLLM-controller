// Top-down TDD step 1 of 5 for guess-game. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("with no input the game greets and then reveals the number", () => {
  assert.deepEqual(play(42, []), ["Guess a number from 1 to 100.", "Game over. The number was 42."]);
});
