// Top-down TDD step 1 of 4 for tictactoe (Playwright). Earlier steps stay in test/ and must keep passing.
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

test("the game starts with an empty board and X to play", async ({ page }) => {
  for (let n = 1; n <= 9; n++) await expect(square(page, n)).toHaveText("");
  await expect(status(page)).toHaveText("Next player: X");
});
