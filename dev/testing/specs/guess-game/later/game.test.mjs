// Inner-layer unit tests (top-down TDD step 2). Not part of the scaffold yet.
// Inner layer for a later top-down TDD step: copy to game/test/ once play() passes (import ../src/game.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuess, createGame } from "../src/game.mjs";

test("checkGuess says 'low' when the guess is below the secret", () => {
  assert.equal(checkGuess(50, 10), "low");
});

test("checkGuess says 'high' when the guess is above the secret", () => {
  assert.equal(checkGuess(50, 90), "high");
});

test("checkGuess says 'correct' when the guess matches", () => {
  assert.equal(checkGuess(50, 50), "correct");
});

test("checkGuess rejects guesses that are not integers from 1 to 100", () => {
  assert.throws(() => checkGuess(50, 0), RangeError);
  assert.throws(() => checkGuess(50, 101), RangeError);
  assert.throws(() => checkGuess(50, 2.5), RangeError);
});

test("createGame counts guesses and reports when the game is won", () => {
  const game = createGame(42);
  assert.equal(game.guess(10), "low");
  assert.equal(game.guess(80), "high");
  assert.equal(game.won, false);
  assert.equal(game.guess(42), "correct");
  assert.equal(game.guesses, 3);
  assert.equal(game.won, true);
});

test("createGame refuses further guesses after a win", () => {
  const game = createGame(7);
  game.guess(7);
  assert.throws(() => game.guess(7), Error);
  assert.equal(game.guesses, 1);
});
