// Top-down TDD, outer layer: acceptance tests for a terminal hangman game.
// play(word, inputs, maxMisses = 6) takes the player's typed lines and returns the printed lines.
// Run inside the game folder: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("a player wins by guessing every letter", () => {
  assert.deepEqual(play("cat", ["c", "a", "t"]), [
    "Word: _ _ _",
    "Yes! Word: c _ _",
    "Yes! Word: c a _",
    "Yes! Word: c a t",
    "You win! The word was cat.",
  ]);
});

test("a wrong letter costs one miss", () => {
  assert.deepEqual(play("cat", ["z", "c", "a", "t"]), [
    "Word: _ _ _",
    "No 'z'. Misses left: 5.",
    "Yes! Word: c _ _",
    "Yes! Word: c a _",
    "Yes! Word: c a t",
    "You win! The word was cat.",
  ]);
});

test("a letter that appears twice is revealed everywhere", () => {
  assert.deepEqual(play("noon", ["o", "n"]), [
    "Word: _ _ _ _",
    "Yes! Word: _ o o _",
    "Yes! Word: n o o n",
    "You win! The word was noon.",
  ]);
});

test("repeated guesses are pointed out and cost nothing", () => {
  assert.deepEqual(play("cat", ["c", "c", "z", "z"]), [
    "Word: _ _ _",
    "Yes! Word: c _ _",
    "You already guessed 'c'.",
    "No 'z'. Misses left: 5.",
    "You already guessed 'z'.",
    "Game over. The word was cat.",
  ]);
});

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

test("the player loses when misses run out, and later input is ignored", () => {
  assert.deepEqual(play("cat", ["x", "y", "c"], 2), [
    "Word: _ _ _",
    "No 'x'. Misses left: 1.",
    "No 'y'. Misses left: 0.",
    "You lose! The word was cat.",
  ]);
});
