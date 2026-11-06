// Top-down TDD, outer layer for the tooling: a sample run as seen from outside.
// Runs the real runner (dev/testing/run-sample.mjs) and agent (scripts/agent.mjs) against a
// fake local model: an HTTP stand-in for Ollama on 127.0.0.1 that sends scripted replies.
// The knowledge DB goes to a temporary SAMPLE_DATA_DIR, never to the real data/.
// Needs the guess-game verify command in .ollama/allowlist.json (checked below).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const game = "guess-game";
const verify = readFileSync(join(root, "dev/testing/specs", game, "verify.txt"), "utf8").trim();
const MODEL = "fake:acceptance";

const CORRECT_GAME = `export function play(secret, inputs) {
  const out = ["Guess a number from 1 to 100."];
  let guesses = 0;
  for (const raw of inputs) {
    const n = Number(raw);
    if (!/^\\d+$/.test(raw.trim()) || n < 1 || n > 100) {
      out.push("Please enter a whole number from 1 to 100.");
      continue;
    }
    guesses++;
    if (n < secret) out.push("Too low.");
    else if (n > secret) out.push("Too high.");
    else {
      out.push(\`Correct! You got it in \${guesses} \${guesses === 1 ? "guess" : "guesses"}.\`);
      return out;
    }
  }
  out.push(\`Game over. The number was \${secret}.\`);
  return out;
}
`;

const call = (tool, args) => JSON.stringify({ tool, args });
const final = (text) => JSON.stringify({ final: text });
const src = `dist/games/${game}/src/game.mjs`;

// Fake Ollama: the reply for a request is chosen by how many assistant turns the agent has
// already had in this conversation, so every agent round replays the same script.
let script = [];
let server;
let port;
before(async () => {
  const allowlist = JSON.parse(readFileSync(join(root, ".ollama/allowlist.json"), "utf8"));
  assert.ok(allowlist.commands.includes(verify), `Add "${verify}" to .ollama/allowlist.json`);
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const { messages } = JSON.parse(body);
      const turn = messages.filter((m) => m.role === "assistant").length;
      const content = script[Math.min(turn, script.length - 1)];
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ done: true, message: { role: "assistant", content } }));
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  port = server.address().port;
});
after(() => server?.close());

function runSample(replies, rounds = 1) {
  script = replies;
  const dataDir = mkdtempSync(join(tmpdir(), "kb-acceptance-"));
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
        OLLAMA_PORT: String(port),
        SAMPLE_DATA_DIR: dataDir,
        SAMPLE_ROUNDS: String(rounds),
        LOCAL_MODEL: MODEL,
        AGENT_ANSWERS: answers,
      },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => done({ code, output, dataDir }));
  });
}

function openDb(dataDir) {
  const file = join(dataDir, "knowledge.db");
  assert.ok(existsSync(file), `no knowledge DB was written to ${file}`);
  return new DatabaseSync(file, { readOnly: true });
}

const all = (db, sql, ...params) => db.prepare(sql).all(...params).map((row) => ({ ...row }));

test("a model that writes correct code passes every step and the run is recorded with chain and credit", async () => {
  const { code, output, dataDir } = await runSample([
    call("write_file", { path: src, content: CORRECT_GAME }),
    final("Implemented play."),
  ]);
  try {
    assert.equal(code, 0, output);
    const db = openDb(dataDir);
    assert.deepEqual(all(db, "SELECT model, result, steps_passed, steps_total FROM runs"),
      [{ model: MODEL, result: "PASS", steps_passed: 5, steps_total: 5 }]);
    // Step 1 is solved by the agent in round 1; the later steps already pass (round 0).
    const attempts = all(db, `SELECT s.name AS step, a.round, a.result FROM attempts a
      JOIN steps s ON s.id = a.step_id ORDER BY a.id`);
    assert.deepEqual(attempts.slice(0, 3), [
      { step: "01-start", round: 0, result: "FAIL" },
      { step: "01-start", round: 1, result: "PASS" },
      { step: "02-hints-and-win", round: 0, result: "PASS" },
    ]);
    assert.deepEqual(all(db, "SELECT signature FROM chains"), [{ signature: "write_file→final" }]);
    assert.deepEqual(all(db, `SELECT c.model, s.name AS step, c.attempts_to_pass FROM credit c
      JOIN steps s ON s.id = c.step_id`), [{ model: MODEL, step: "01-start", attempts_to_pass: 1 }]);
    const passing = all(db, "SELECT tests_passed, tests_total FROM attempts WHERE result = 'PASS' ORDER BY id DESC LIMIT 1");
    assert.deepEqual(passing, [{ tests_passed: 6, tests_total: 6 }]);
    db.close();
    assert.ok(existsSync(join(dataDir, "backups")), "no snapshot folder");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a model that only claims success fails, and the rejected claims are recorded without credit", async () => {
  const { code, output, dataDir } = await runSample([
    call("read_file", { path: `dist/games/${game}/test/01-start.test.mjs` }),
    final("All tests pass."),
  ]);
  try {
    assert.equal(code, 1, output);
    const db = openDb(dataDir);
    assert.deepEqual(all(db, "SELECT result, steps_passed FROM runs"), [{ result: "FAIL", steps_passed: 0 }]);
    const kinds = all(db, "SELECT kind, COUNT(*) AS n FROM events WHERE kind IS NOT NULL GROUP BY kind ORDER BY kind");
    assert.ok(kinds.some((k) => k.kind === "verify-failed" && k.n >= 1), JSON.stringify(kinds));
    assert.ok(kinds.some((k) => k.kind === "step-limit"), JSON.stringify(kinds));
    assert.deepEqual(all(db, "SELECT COUNT(*) AS n FROM credit"), [{ n: 0 }]);
    assert.deepEqual(all(db, "SELECT COUNT(*) AS n FROM chains"), [{ n: 0 }]);
    db.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("fenced code and writes to protected tests are refused and recorded; tests stay unchanged", async () => {
  const testFile = `dist/games/${game}/test/01-start.test.mjs`;
  const { code, output, dataDir } = await runSample([
    call("write_file", { path: testFile, content: "// replaced by the model\n" }),
    call("write_file", { path: src, content: "```js\n" + CORRECT_GAME + "```\n" }),
    final("Done."),
  ]);
  try {
    assert.equal(code, 1, output);
    assert.equal(readFileSync(join(root, testFile), "utf8"),
      readFileSync(join(root, "dev/testing/specs", game, "steps/01-start.test.mjs"), "utf8"));
    const db = openDb(dataDir);
    const errors = all(db, "SELECT tool, path, kind FROM events WHERE outcome = 'error' AND tool = 'write_file' ORDER BY seq");
    assert.deepEqual(errors.slice(0, 2), [
      { tool: "write_file", path: testFile, kind: "protected-path" },
      { tool: "write_file", path: src, kind: "fence" },
    ]);
    db.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
