// Top-down TDD sample run, in small steps and batches of agent rounds, recorded in the
// knowledge DB (data/knowledge.db; see dev/architecture/tdd-runner.md and knowledge-db.md).
//
// 1. Delete dist/games/<name>, copy the freestanding scaffold dev/testing/specs/<name>/game/
//    there and run npm ci if it has a lockfile.
// 2. For each test in dev/testing/specs/<name>/steps/ (sorted): add it to the game's test/
//    folder (earlier steps stay) and run the verify command (attempt round 0). If it fails,
//    start the local agent for up to SAMPLE_ROUNDS rounds. Each round is a fresh conversation
//    (at most 12 agent steps) that continues from the code left by the previous round and gets
//    the current test failures in its task.
// 3. Stop at the first step that still fails after all rounds (exit 1), or exit 0 when all pass.
//
// Everything copied from the scaffold except src/, plus test/, is read-only for the model.
// Usage: node dev/testing/run-sample.mjs <name>   (AGENT_ANSWERS, LOCAL_MODEL, SAMPLE_ROUNDS pass through)
import { spawnSync } from "node:child_process";
import {
  appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openKnowledgeDb, parseTestCounts, sha256 } from "./knowledge-db.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const name = process.argv[2] ?? "";
if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Usage: node dev/testing/run-sample.mjs <name> (a-z, 0-9, -)");
const rounds = Number(process.env.SAMPLE_ROUNDS ?? 3);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error("SAMPLE_ROUNDS must be 1-20.");
// Must match the agent's default in scripts/agent.mjs.
const model = process.env.LOCAL_MODEL ?? "qwen2.5-coder:3b";

const specDir = join(root, "dev", "testing", "specs", name);
const scaffold = join(specDir, "game");
const stepsDir = join(specDir, "steps");
for (const required of [join(specDir, "task.txt"), join(specDir, "verify.txt"), join(scaffold, "package.json"), stepsDir]) {
  if (!existsSync(required)) throw new Error(`Spec ${name} is missing ${required}`);
}
const baseTask = readFileSync(join(specDir, "task.txt"), "utf8").trim();
const verify = readFileSync(join(specDir, "verify.txt"), "utf8").trim();
const steps = readdirSync(stepsDir).filter((f) => /\.(test|spec)\.mjs$/.test(f)).sort();
if (steps.length === 0) throw new Error(`No step tests in ${stepsDir}`);

const outRel = join("dist", "games", name);
const outDir = join(root, outRel);
// SAMPLE_DATA_DIR (tests) puts the knowledge DB elsewhere; default data/, write-protected from the model.
const dataDir = process.env.SAMPLE_DATA_DIR ? resolve(process.env.SAMPLE_DATA_DIR) : join(root, "data");
const eventsDir = join(dataDir, "events");
const runLog = join(root, "logs", `sample-${name}.log`);
const agentLog = join(root, "logs", "terminal-output.log");
mkdirSync(dirname(runLog), { recursive: true });
mkdirSync(eventsDir, { recursive: true });
writeFileSync(runLog, "");
const report = (line) => {
  console.log(line);
  appendFileSync(runLog, line + "\n");
};

rmSync(outDir, { recursive: true, force: true });
cpSync(scaffold, outDir, { recursive: true });
mkdirSync(join(outDir, "test"), { recursive: true });
if (existsSync(join(outDir, "package-lock.json"))) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npm, ["ci", "--no-audit", "--no-fund"], { cwd: outDir, stdio: "inherit" });
  if (install.status !== 0) throw new Error(`npm ci failed in ${outRel}`);
}

const kb = openKnowledgeDb(join(dataDir, "knowledge.db"));
const taskId = kb.upsertTask(name, sha256(`${baseTask}\n${verify}`));
const stepIds = steps.map((step, index) => kb.upsertStep(taskId, index + 1, step.replace(/\.(test|spec)\.mjs$/, ""),
  sha256(readFileSync(join(stepsDir, step), "utf8"))));
const runId = kb.startRun({ taskId, model, roundsLimit: rounds, stepsTotal: steps.length });
report(`Run ${runId}: ${outRel} with ${model}, ${steps.length} steps, up to ${rounds} rounds each`);

const readonly = new Set([...readdirSync(scaffold), "test"].filter((entry) => entry !== "src"));
const agentEnv = {
  ...process.env,
  AGENT_VERIFY: verify,
  AGENT_READONLY: [...readonly].map((entry) => join(outRel, entry)).join(","),
};

// SIGTERM on timeout (not SIGKILL) so Playwright can stop the server it started.
function runVerify() {
  const result = spawnSync("sh", ["-c", verify], {
    cwd: root,
    encoding: "utf8",
    timeout: 180000,
    killSignal: "SIGTERM",
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { passed: result.status === 0, exitCode: result.status, output, ...parseTestCounts(output) };
}

// Run verify and store it as the attempt's verification and result.
function check(attemptId, started, agentExit = null) {
  const verification = runVerify();
  kb.addVerification(attemptId, { command: verify, ...verification });
  const total = verification.passed !== null || verification.failed !== null
    ? (verification.passed ?? 0) + (verification.failed ?? 0) : null;
  kb.finishAttempt(attemptId, {
    result: verification.exitCode === 0 ? "PASS" : "FAIL",
    testsPassed: verification.passed,
    testsTotal: total,
    durationMs: Date.now() - started,
    agentExit,
  });
  return { ok: verification.exitCode === 0, output: verification.output };
}

// Keep the end of the output, where the failure summary is, at a size small models can use.
const tail = (text, max = 3000) => (text.length > max ? "[...]\n" + text.slice(-max) : text);

let stepsPassed = 0;
let allPassed = true;
try {
  for (const [index, step] of steps.entries()) {
    copyFileSync(join(stepsDir, step), join(outDir, "test", step));
    const stepId = stepIds[index];
    const label = `Step ${index + 1}/${steps.length} (${step})`;
    let attemptId = kb.startAttempt({ runId, stepId, round: 0 });
    let status = check(attemptId, Date.now());
    if (status.ok) {
      report(`${label}: already passes`);
      stepsPassed++;
      continue;
    }
    for (let round = 1; round <= rounds && !status.ok; round++) {
      const task = [
        baseTask,
        `This is ${label}, round ${round}/${rounds}. The tests in ${outRel}/test/ are fixed: do not edit them.`,
        `New test for this step: ${outRel}/test/${step}. Earlier tests in that folder must keep passing.`,
        `Run the tests with exactly this command: ${verify}`,
        `Current test output:\n${tail(status.output)}`,
      ].join("\n\n");
      attemptId = kb.startAttempt({ runId, stepId, round });
      const eventsFile = join(eventsDir, `attempt-${attemptId}.jsonl`);
      rmSync(eventsFile, { force: true });
      const started = Date.now();
      const agent = spawnSync(process.execPath, [join(root, "scripts", "agent.mjs"), task], {
        stdio: "inherit",
        env: { ...agentEnv, AGENT_EVENTS: eventsFile },
      });
      if (existsSync(eventsFile)) {
        const events = readFileSync(eventsFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
        kb.addEvents(attemptId, events);
        rmSync(eventsFile, { force: true });
      }
      if (existsSync(agentLog)) appendFileSync(runLog, `--- ${label} round ${round} agent log ---\n${readFileSync(agentLog, "utf8")}`);
      status = check(attemptId, started, agent.status);
      if (status.ok) {
        const chain = kb.recordSuccess(attemptId, { model, stepId, runId, round });
        report(`${label}, round ${round}: agent exit=${agent.status}, tests PASS (chain: ${chain})`);
      } else {
        report(`${label}, round ${round}: agent exit=${agent.status}, tests FAIL`);
      }
    }
    if (!status.ok) {
      report(`${label}: still failing after ${rounds} rounds. Stopping.`);
      allPassed = false;
      break;
    }
    stepsPassed++;
  }
} finally {
  kb.finishRun(runId, { result: allPassed && stepsPassed === steps.length ? "PASS" : "FAIL", stepsPassed });
  const snapshot = kb.snapshot(join(dataDir, "backups"));
  kb.close();
  report(`${allPassed ? `All ${steps.length} steps pass.` : "Run incomplete."} Recorded as run ${runId}; snapshot ${snapshot}`);
}
process.exit(allPassed ? 0 : 1);
