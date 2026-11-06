import { defineConfig, devices } from "@playwright/test";
import { port } from "./playwright.global-setup.mjs";

export default defineConfig({
  testDir: "test",
  timeout: 5000,
  expect: { timeout: 2000 },
  reporter: "list",
  globalSetup: "./playwright.global-setup.mjs",
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
