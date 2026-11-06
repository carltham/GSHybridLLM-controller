// Top-down TDD step 2 of 4 for tictactoe (Playwright). Earlier steps stay in test/ and must keep passing.
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

test("players take turns", async ({ page }) => {
  await square(page, 1).click();
  await expect(square(page, 1)).toHaveText("X");
  await expect(status(page)).toHaveText("Next player: O");
  await square(page, 5).click();
  await expect(square(page, 5)).toHaveText("O");
  await expect(status(page)).toHaveText("Next player: X");
});

test("clicking a taken square changes nothing", async ({ page }) => {
  await playMoves(page, [1, 1]);
  await expect(square(page, 1)).toHaveText("X");
  await expect(status(page)).toHaveText("Next player: O");
});
