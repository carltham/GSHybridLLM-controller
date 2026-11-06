// Read-only: prints Copilot auth status and available model IDs; sends no prompt.
import { CopilotClient } from "@github/copilot-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const logFile = join(dirname(fileURLToPath(import.meta.url)), "..", "logs", "terminal-output.log");
const lines = [];
const out = (line) => {
  console.log(line);
  lines.push(line);
};

const client = new CopilotClient({
  mode: "empty",
  workingDirectory: tmpdir(),
  baseDirectory: join(tmpdir(), `gshybrid-copilot-${randomUUID()}`),
});
try {
  await client.start();
  const auth = await client.getAuthStatus();
  out(`authenticated: ${auth.isAuthenticated}`);
  if (auth.isAuthenticated) {
    for (const m of await client.listModels()) out(`${m.id} - ${m.name ?? ""}`);
  }
} finally {
  await client.stop();
  mkdirSync(dirname(logFile), { recursive: true });
  writeFileSync(logFile, lines.join("\n") + "\n");
}
