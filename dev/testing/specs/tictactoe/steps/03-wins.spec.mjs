// Top-down TDD step 3 of 4 for tictactoe (Playwright). Earlier steps stay in test/ and must keep passing.
// UI contract for src/TicTacToe.jsx (default export):
// - nine buttons labelled "Square 1" … "Square 9" (row by row), text "X", "O" or empty
// - an element with role="status": "Next player: X", "Winner: O" or "Draw!"
// - a "Restart" button that empties the board
import { test, expect } from "@playwright/test";

const square = (page, n) => page.getByRole("button", { name: `Square ${n}` });
const status = (page) => page.getByRole("status");
const playMoves = async (page, moves) => {
  for (const n of moves) await square(page, n).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("X wins with a row", async ({ page }) => {
  await playMoves(page, [1, 4, 2, 5, 3]);
  await expect(status(page)).toHaveText("Winner: X");
});

test("O wins with a column", async ({ page }) => {
  await playMoves(page, [1, 2, 4, 5, 9, 8]);
  await expect(status(page)).toHaveText("Winner: O");
});

test("X wins with a diagonal", async ({ page }) => {
  await playMoves(page, [1, 2, 5, 3, 9]);
  await expect(status(page)).toHaveText("Winner: X");
});

test("no moves are allowed after a win", async ({ page }) => {
  await playMoves(page, [1, 4, 2, 5, 3, 9]);
  await expect(square(page, 9)).toHaveText("");
  await expect(status(page)).toHaveText("Winner: X");
});
