// Runs Vite inside the Playwright process (not as a separate webServer process), so the
// server always stops when Playwright stops, even if the test run is killed on a timeout.
import { createServer } from "vite";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const port = 5179;

export default async function globalSetup() {
  const server = await createServer({
    root: dirname(fileURLToPath(import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port, strictPort: true },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
