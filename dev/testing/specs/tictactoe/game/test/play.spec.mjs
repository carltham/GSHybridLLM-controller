// Top-down TDD, outer layer: acceptance tests for tic-tac-toe in a real browser (Playwright).
// UI contract for src/TicTacToe.jsx (default export):
// - nine buttons labelled "Square 1" … "Square 9" (row by row), text "X", "O" or empty
// - an element with role="status": "Next player: X", "Winner: O" or "Draw!"
// - a "Restart" button that empties the board
// Run inside the game folder: npm test
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

test("a full board without a line is a draw", async ({ page }) => {
  await playMoves(page, [1, 2, 3, 5, 4, 6, 8, 7, 9]);
  await expect(status(page)).toHaveText("Draw!");
});

test("restart empties the board and gives X the first move", async ({ page }) => {
  await playMoves(page, [1, 5]);
  await page.getByRole("button", { name: "Restart" }).click();
  for (let n = 1; n <= 9; n++) await expect(square(page, n)).toHaveText("");
  await expect(status(page)).toHaveText("Next player: X");
});
