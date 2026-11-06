// Fresh sample run: delete dist/testing/<name>, copy dev/testing/specs/<name>/*.test.mjs into it,
// then start the local agent with the spec's task.txt. dist/ is git-ignored output.
// Usage: node dev/testing/run-sample.mjs <name>   (AGENT_ANSWERS etc. pass through)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const name = process.argv[2] ?? "";
if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Usage: node dev/testing/run-sample.mjs <name> (a-z, 0-9, -)");

const specDir = join(root, "dev", "testing", "specs", name);
const taskFile = join(specDir, "task.txt");
if (!existsSync(taskFile)) throw new Error(`Missing ${taskFile}`);
const outDir = join(root, "dist", "testing", name);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(specDir).filter((f) => f.endsWith(".test.mjs"))) {
  copyFileSync(join(specDir, file), join(outDir, file));
}
console.log(`Cleaned and prepared dist/testing/${name}`);

const task = readFileSync(taskFile, "utf8").trim();
const result = spawnSync(process.execPath, [join(root, "scripts", "agent.mjs"), task], { stdio: "inherit" });
process.exit(result.status ?? 1);
