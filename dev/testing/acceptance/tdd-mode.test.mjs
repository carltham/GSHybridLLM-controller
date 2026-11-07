// Top-down TDD, outer layer for step 2: the agent's TDD mode as seen from outside.
// In a sample run the model gets only atomic tools bound to the spec's one source file, starts
// from a starter file with the right export shape, sees the current source and the new step test
// in its task, and is sampled at a low temperature.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  root, MODEL, call, final, startFakeOllama, assertVerifyAllowListed, runSample, openDb, all,
} from "./fake-ollama.mjs";

const game = "guess-game";
const starterPath = join(root, "dev/testing/specs", game, "game/src/game.mjs");
const sourcePath = join(root, "dist/games", game, "src/game.mjs");

const CORRECT_BODY = `  const lines = ["Guess a number from 1 to 100."];
  let guesses = 0;
  for (const raw of inputs) {
    const n = Number(raw);
    if (!/^\\d+$/.test(raw.trim()) || n < 1 || n > 100) {
      lines.push("Please enter a whole number from 1 to 100.");
      continue;
    }
    guesses++;
    if (n < secret) lines.push("Too low.");
    else if (n > secret) lines.push("Too high.");
    else {
      lines.push(\`Correct! You got it in \${guesses} \${guesses === 1 ? "guess" : "guesses"}.\`);
      return lines;
    }
  }
  lines.push(\`Game over. The number was \${secret}.\`);
  return lines;
`;

let fake;
before(async () => {
  assertVerifyAllowListed(game);
  fake = await startFakeOllama();
});
after(() => fake?.close());

test("the spec provides a starter source file with the right export shape", () => {
  const starter = readFileSync(starterPath, "utf8");
  assert.match(starter, /^export function play\(secret, inputs\) \{$/m);
  assert.match(starter, /return lines;/);
});

test("the model sees only atomic tools, the starter source and the step test, at low temperature", async () => {
  const { dataDir } = await runSample(fake, game, [final("nothing to do")]);
  rmSync(dataDir, { recursive: true, force: true });
  const first = fake.requests[0];
  assert.ok(first, "the agent never called the model");
  const system = first.messages.find((m) => m.role === "system").content;
  for (const tool of ["read_test", "read_source", "replace_in_file", "write_source", "run_tests"]) {
    assert.match(system, new RegExp(`\\b${tool}\\b`), `system prompt lacks ${tool}`);
  }
  for (const tool of ["write_file", "run_command", "list_dir", "read_file"]) {
    assert.doesNotMatch(system, new RegExp(`\\b${tool}\\b`), `system prompt still offers ${tool}`);
  }
  assert.equal(first.options.temperature, 0.2);
  const task = first.messages.find((m) => m.role === "user").content;
  assert.match(task, /export function play\(secret, inputs\)/, "task lacks the current source");
  assert.match(task, /with no input the game greets and then reveals the number/, "task lacks the step test");
});

test("a model that edits the starter with replace_in_file passes, and the chain is recorded", async () => {
  const starter = readFileSync(starterPath, "utf8");
  const oldBody = starter.slice(starter.indexOf("{\n") + 2, starter.lastIndexOf("}"));
  const { code, output, dataDir } = await runSample(fake, game, [
    call("read_source"),
    call("replace_in_file", { old: oldBody, new: CORRECT_BODY }),
    call("run_tests"),
    final("Implemented play."),
  ]);
  try {
    assert.equal(code, 0, output);
    const db = openDb(dataDir);
    assert.deepEqual(all(db, "SELECT model, result, steps_passed FROM runs"), [{ model: MODEL, result: "PASS", steps_passed: 5 }]);
    assert.deepEqual(all(db, "SELECT signature FROM chains"), [{ signature: "read_source→replace_in_file→run_tests→final" }]);
    // Runs record how they were configured, so TDD-mode runs can be told apart from others.
    assert.deepEqual(all(db, "SELECT mode, temperature FROM runs"), [{ mode: "tdd", temperature: 0.2 }]);
    db.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("broad tools are refused and replace mistakes are recorded; the source stays the starter", async () => {
  const { code, output, dataDir } = await runSample(fake, game, [
    call("write_file", { path: "dist/games/guess-game/src/game.mjs", content: "x" }),
    call("run_command", { command: "echo hi" }),
    call("replace_in_file", { old: "this text is not in the file", new: "x" }),
    final("Done."),
  ]);
  try {
    assert.equal(code, 1, output);
    assert.equal(readFileSync(sourcePath, "utf8"), readFileSync(starterPath, "utf8"));
    const db = openDb(dataDir);
    const kinds = all(db, "SELECT tool, kind FROM events WHERE outcome <> 'ok' ORDER BY seq").slice(0, 4);
    assert.deepEqual(kinds, [
      { tool: "write_file", kind: "unknown-tool" },
      { tool: "run_command", kind: "unknown-tool" },
      { tool: "replace_in_file", kind: "replace-no-match" },
      { tool: "final", kind: "verify-failed" },
    ]);
    db.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
