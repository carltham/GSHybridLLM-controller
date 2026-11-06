import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  generateWithOllama, planWithCopilot, requireText, runTask,
} from "../core/controller.js";

const help = `GSHybridLLM controller

Usage: npm start
       npm start -- --help

Set CLOUD_MODEL to an exact model ID available to your Copilot account.
Set LOCAL_MODEL to an installed Ollama model (for example qwen2.5-coder:7b).

Only explicitly approved non-sensitive task descriptions go to Copilot.
Local context and local answers are never forwarded to Copilot.
No file edits, shell execution, model downloads or automatic uploads.
`;

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    stdout.write(help);
    return;
  }
  if (process.argv.length > 2) throw new Error("Unknown argument. Use --help.");
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("An interactive terminal is required for approvals.");
  }
  const cloudModel = requireText(process.env.CLOUD_MODEL, "CLOUD_MODEL", 200);
  const localModel = requireText(process.env.LOCAL_MODEL, "LOCAL_MODEL", 200);
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    stdout.write(help);
    const request = await terminal.question("\nNon-sensitive task description (NO code or secrets): ");
    let context = "";
    const results = await runTask(request, context, {
      approveCloud: async (text) => {
        stdout.write(`\nExact user request to send to Copilot:\n${text}\n`);
        return await terminal.question("Confirm this contains no sensitive data. Type SEND: ") === "SEND";
      },
      plan: (text) => planWithCopilot(text, cloudModel),
      approveLocal: async (plan) => {
        stdout.write(`\nCloud-proposed local tasks:\n${JSON.stringify(plan, null, 2)}\n`);
        if (await terminal.question("Approve these text-only tasks? Type RUN: ") !== "RUN") {
          return false;
        }
        stdout.write("\nOptional local-only context. End with a line containing .end\n");
        const lines: string[] = [];
        let length = 0;
        while (true) {
          const line = await terminal.question("> ");
          if (line === ".end") break;
          length += line.length + 1;
          if (length > 64000) throw new Error("Local context exceeds 64000 characters.");
          lines.push(line);
        }
        context = lines.join("\n");
        return true;
      },
      generate: (instruction) => generateWithOllama(localModel, instruction, context),
    });
    for (const [index, result] of results.entries()) {
      stdout.write(`\nLocal result ${index + 1} (unverified suggestion; kept local):\n${result.output}\n`);
    }
  } finally {
    terminal.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
