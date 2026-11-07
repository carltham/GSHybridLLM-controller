// Top-down TDD step 2d of hangman: parent of 02a-02c (the original step 2). Its own test decides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("a correct letter is revealed", () => {
  assert.deepEqual(play("cat", ["c"]), ["Word: _ _ _", "Yes! Word: c _ _", "Game over. The word was cat."]);
});

test("a letter that appears twice is revealed everywhere", () => {
  assert.deepEqual(play("noon", ["o"]), ["Word: _ _ _ _", "Yes! Word: _ o o _", "Game over. The word was noon."]);
});
