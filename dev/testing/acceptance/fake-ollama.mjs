// Test helper (not a test): a fake local model for acceptance tests, plus a sample-run driver.
// The fake answers POST /api/chat on 127.0.0.1 with scripted replies. The reply is chosen by how
// many assistant turns the agent already had in the conversation, so every agent round replays
// the same script. All requests are kept for inspection.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const MODEL = "fake:acceptance";

export const call = (tool, args = {}) => JSON.stringify({ tool, args });
export const final = (text) => JSON.stringify({ final: text });

// out: this test file's own game folder (relative to the project root), so files can run in parallel.
export async function startFakeOllama(out) {
  if (!/^dist\/acceptance\/[a-z0-9-]+$/.test(out ?? "")) throw new Error("startFakeOllama needs out = dist/acceptance/<file>");
  const fake = { script: [], requests: [], out };
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const request = JSON.parse(body);
      fake.requests.push(request);
      const turn = request.messages.filter((m) => m.role === "assistant").length;
      const content = fake.script[Math.min(turn, fake.script.length - 1)];
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ done: true, message: { role: "assistant", content } }));
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  fake.port = server.address().port;
  fake.close = () => server.close();
  return fake;
}

export function assertVerifyAllowListed(game) {
  const verify = readFileSync(join(root, "dev/testing/specs", game, "verify.txt"), "utf8").trim();
  const allowlist = JSON.parse(readFileSync(join(root, ".ollama/allowlist.json"), "utf8"));
  if (!allowlist.commands.includes(verify)) throw new Error(`Add "${verify}" to .ollama/allowlist.json`);
}

// Runs dev/testing/run-sample.mjs against the fake model with a temporary knowledge DB and log
// folder; the game is built in the file's own folder (fake.out).
export function runSample(fake, game, replies, { rounds = 1 } = {}) {
  fake.script = replies;
  fake.requests = [];
  const dataDir = mkdtempSync(join(tmpdir(), "kb-acceptance-"));
  const logDir = join(dataDir, "logs");
  const answers = join(dataDir, "answers.txt");
  writeFileSync(answers, "write: y\n".repeat(10));
  // Child processes must not inherit node --test's context, or they report as test workers.
  const { NODE_TEST_CONTEXT, ...parentEnv } = process.env;
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(root, "dev/testing/run-sample.mjs"), game], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...parentEnv,
        OLLAMA_PORT: String(fake.port),
        SAMPLE_DATA_DIR: dataDir,
        SAMPLE_OUT_DIR: fake.out,
        SAMPLE_LOG_DIR: logDir,
        SAMPLE_ROUNDS: String(rounds),
        LOCAL_MODEL: MODEL,
        AGENT_ANSWERS: answers,
      },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => done({ code, output, dataDir, logDir }));
  });
}

export function openDb(dataDir) {
  const file = join(dataDir, "knowledge.db");
  if (!existsSync(file)) throw new Error(`no knowledge DB was written to ${file}`);
  return new DatabaseSync(file, { readOnly: true });
}

export const all = (db, sql, ...params) => db.prepare(sql).all(...params).map((row) => ({ ...row }));
