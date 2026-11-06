import { defineConfig, devices } from "@playwright/test";

const port = 5179;
export default defineConfig({
  testDir: "test",
  timeout: 15000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
