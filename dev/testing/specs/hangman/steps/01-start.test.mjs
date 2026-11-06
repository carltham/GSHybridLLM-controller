// Top-down TDD step 1 of 6 for hangman. Earlier steps' tests stay in test/ and must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play } from "../src/hangman.mjs";

test("with no input the hidden word is shown and then revealed", () => {
  assert.deepEqual(play("cat", []), ["Word: _ _ _", "Game over. The word was cat."]);
});
