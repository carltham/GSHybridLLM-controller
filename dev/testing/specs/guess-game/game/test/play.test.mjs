// Top-down TDD, outer layer: acceptance tests for a whole game as a player sees it.
// play(secret, inputs) takes the player's typed lines and returns the printed lines.
// The unit tests in ../../later/game.test.mjs are the layer below.
// Run inside the game folder: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/game.mjs";

test("a player wins after a low and a high guess", () => {
  assert.deepEqual(play(42, ["10", "80", "42"]), [
    "Guess a number from 1 to 100.",
    "Too low.",
    "Too high.",
    "Correct! You got it in 3 guesses.",
  ]);
});

test("a first-try win uses the singular 'guess'", () => {
  assert.deepEqual(play(7, ["7"]), [
    "Guess a number from 1 to 100.",
    "Correct! You got it in 1 guess.",
  ]);
});

test("invalid input is explained and not counted as a guess", () => {
  assert.deepEqual(play(5, ["abc", "0", "5"]), [
    "Guess a number from 1 to 100.",
    "Please enter a whole number from 1 to 100.",
    "Please enter a whole number from 1 to 100.",
    "Correct! You got it in 1 guess.",
  ]);
});

test("input after a win is ignored", () => {
  assert.deepEqual(play(3, ["3", "50"]), [
    "Guess a number from 1 to 100.",
    "Correct! You got it in 1 guess.",
  ]);
});

test("running out of input reveals the number", () => {
  assert.deepEqual(play(60, ["20"]), [
    "Guess a number from 1 to 100.",
    "Too low.",
    "Game over. The number was 60.",
  ]);
});
