// Fresh sample run: delete dist/games/<name>, copy the freestanding game scaffold
// dev/testing/specs/<name>/game/ into it, then start the local agent with the spec's task.txt.
// dist/ is git-ignored output. If the game has a package-lock.json, npm ci installs its own
// dependencies. Everything copied from the scaffold except src/ is read-only for the model,
// so it cannot pass the gate by editing tests, configs or the test script.
// Usage: node dev/testing/run-sample.mjs <name>   (AGENT_ANSWERS, LOCAL_MODEL etc. pass through)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const name = process.argv[2] ?? "";
if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Usage: node dev/testing/run-sample.mjs <name> (a-z, 0-9, -)");

const specDir = join(root, "dev", "testing", "specs", name);
const scaffold = join(specDir, "game");
const taskFile = join(specDir, "task.txt");
if (!existsSync(taskFile) || !existsSync(join(scaffold, "package.json"))) {
  throw new Error(`Spec ${name} needs task.txt and game/package.json`);
}
const outRel = join("dist", "games", name);
const outDir = join(root, outRel);

rmSync(outDir, { recursive: true, force: true });
cpSync(scaffold, outDir, { recursive: true });
console.log(`Cleaned and prepared ${outRel}`);
if (existsSync(join(outDir, "package-lock.json"))) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npm, ["ci", "--no-audit", "--no-fund"], { cwd: outDir, stdio: "inherit" });
  if (install.status !== 0) throw new Error(`npm ci failed in ${outRel}`);
}

const env = { ...process.env };
// verify.txt (optional): the allow-listed test command that must pass before the agent may finish.
const verifyFile = join(specDir, "verify.txt");
if (existsSync(verifyFile) && !env.AGENT_VERIFY) env.AGENT_VERIFY = readFileSync(verifyFile, "utf8").trim();
env.AGENT_READONLY = readdirSync(scaffold)
  .filter((entry) => entry !== "src")
  .map((entry) => join(outRel, entry))
  .join(",");

const task = readFileSync(taskFile, "utf8").trim();
const result = spawnSync(process.execPath, [join(root, "scripts", "agent.mjs"), task], { stdio: "inherit", env });
process.exit(result.status ?? 1);
