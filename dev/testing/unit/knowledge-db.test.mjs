// Unit tests for dev/testing/knowledge-db.mjs (in-memory and temp-file SQLite; no models).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKnowledgeDb, parseTestCounts } from "../knowledge-db.mjs";

test("parses node:test and Playwright counts", () => {
  assert.deepEqual(parseTestCounts("# tests 3\n# pass 2\n# fail 1\n"), { passed: 2, failed: 1 });
  assert.deepEqual(parseTestCounts("  4 passed (3.1s)\n"), { passed: 4, failed: 0 });
  assert.deepEqual(parseTestCounts("  1 failed\n  2 passed (2s)\n"), { passed: 2, failed: 1 });
  assert.deepEqual(parseTestCounts("SyntaxError: nothing ran"), { passed: null, failed: null });
});

test("tasks and steps are reused, and a changed test becomes a new step", () => {
  const kb = openKnowledgeDb(":memory:");
  const task = kb.upsertTask("hangman", "h1");
  assert.equal(kb.upsertTask("hangman", "h2"), task);
  const step = kb.upsertStep(task, 1, "01-start", "t1");
  assert.equal(kb.upsertStep(task, 1, "01-start", "t1"), step);
  assert.notEqual(kb.upsertStep(task, 1, "01-start", "t2"), step);
  kb.close();
});

test("a passing attempt records its events, chain and credit", () => {
  const kb = openKnowledgeDb(":memory:");
  const task = kb.upsertTask("guess-game", "h");
  const step = kb.upsertStep(task, 1, "01-start", "t");
  const run = kb.startRun({ taskId: task, model: "m:1b", roundsLimit: 3, stepsTotal: 1 });
  const attempt = kb.startAttempt({ runId: run, stepId: step, round: 2 });
  kb.addEvents(attempt, [
    { seq: 1, step: 1, tool: "read_file", path: "a", outcome: "ok", ms: 5 },
    { seq: 2, step: 2, tool: "write_file", path: "b", outcome: "error", kind: "fence", ms: 6 },
    { seq: 3, step: 3, tool: "write_file", path: "b", outcome: "ok", ms: 7 },
    { seq: 4, step: 4, tool: "final", outcome: "ok", ms: 8 },
  ]);
  kb.addVerification(attempt, { command: "node --test", exitCode: 0, passed: 1, failed: 0, output: "# pass 1" });
  kb.finishAttempt(attempt, { result: "PASS", testsPassed: 1, testsTotal: 1, durationMs: 100, agentExit: 0 });
  assert.equal(kb.recordSuccess(attempt, { model: "m:1b", stepId: step, runId: run, round: 2 }),
    "read_file→write_file→write_file→final");
  kb.finishRun(run, { result: "PASS", stepsPassed: 1 });
  const credit = kb.db.prepare("SELECT model, attempts_to_pass FROM credit").get();
  assert.deepEqual({ ...credit }, { model: "m:1b", attempts_to_pass: 2 });
  const fence = kb.db.prepare("SELECT COUNT(*) AS n FROM events WHERE kind = 'fence'").get();
  assert.equal(fence.n, 1);
  kb.close();
});

test("snapshots are consistent copies and only the newest are kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "kb-"));
  try {
    const kb = openKnowledgeDb(join(dir, "knowledge.db"));
    kb.upsertTask("t", "h");
    const first = kb.snapshot(join(dir, "backups"), 2);
    assert.ok(existsSync(first));
    const copy = openKnowledgeDb(first);
    assert.equal(copy.db.prepare("SELECT COUNT(*) AS n FROM tasks").get().n, 1);
    copy.close();
    for (const name of ["knowledge-2000-01-01T00-00-00.db", "knowledge-2000-01-02T00-00-00.db"]) {
      kb.db.prepare("VACUUM INTO ?").run(join(dir, "backups", name));
    }
    kb.snapshot(join(dir, "backups"), 2);
    const kept = readdirSync(join(dir, "backups")).filter((f) => f.endsWith(".db"));
    assert.equal(kept.length, 2);
    assert.ok(!kept.includes("knowledge-2000-01-01T00-00-00.db"));
    kb.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
