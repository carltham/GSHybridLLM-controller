// Knowledge DB: records sample runs as structured data (see dev/architecture/knowledge-db.md).
// SQLite via Node's built-in node:sqlite. The file lives in data/ (git-ignored, never exported
// to GitHub, write-protected from the model); snapshots in data/backups/ keep it savable.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  spec_hash TEXT,
  parent_id INTEGER REFERENCES tasks(id),
  depth INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'hand',
  created TEXT NOT NULL,
  UNIQUE (name, parent_id)
);
CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  ord INTEGER NOT NULL,
  name TEXT NOT NULL,
  test_hash TEXT NOT NULL,
  UNIQUE (task_id, name, test_hash)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  model TEXT NOT NULL,
  started TEXT NOT NULL,
  finished TEXT,
  rounds_limit INTEGER NOT NULL,
  result TEXT,
  steps_passed INTEGER NOT NULL DEFAULT 0,
  steps_total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  step_id INTEGER NOT NULL REFERENCES steps(id),
  round INTEGER NOT NULL,
  started TEXT NOT NULL,
  duration_ms INTEGER,
  agent_exit INTEGER,
  result TEXT,
  tests_passed INTEGER,
  tests_total INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  seq INTEGER NOT NULL,
  agent_step INTEGER,
  tool TEXT,
  path TEXT,
  outcome TEXT NOT NULL,
  kind TEXT,
  duration_ms INTEGER,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  command TEXT NOT NULL,
  exit_code INTEGER,
  passed INTEGER,
  failed INTEGER,
  output_tail TEXT
);
CREATE TABLE IF NOT EXISTS chains (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL UNIQUE REFERENCES attempts(id),
  signature TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS credit (
  id INTEGER PRIMARY KEY,
  model TEXT NOT NULL,
  step_id INTEGER NOT NULL REFERENCES steps(id),
  run_id INTEGER NOT NULL REFERENCES runs(id),
  attempts_to_pass INTEGER NOT NULL,
  UNIQUE (run_id, step_id)
);
CREATE INDEX IF NOT EXISTS events_attempt ON events(attempt_id);
CREATE INDEX IF NOT EXISTS attempts_run ON attempts(run_id);
`;

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();

// Test counts from node:test ("# pass 3" / "# fail 1") or Playwright ("3 passed" / "1 failed").
export function parseTestCounts(output) {
  const num = (re) => {
    const match = re.exec(output);
    return match ? Number(match[1]) : null;
  };
  let passed = num(/^# pass (\d+)$/m);
  let failed = num(/^# fail (\d+)$/m);
  if (passed === null && failed === null) {
    passed = num(/^\s*(\d+) passed\b/m);
    failed = num(/^\s*(\d+) failed\b/m);
    if (passed !== null || failed !== null) {
      passed ??= 0;
      failed ??= 0;
    }
  }
  return { passed, failed };
}

export function openKnowledgeDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > SCHEMA_VERSION) throw new Error(`Knowledge DB schema ${version} is newer than this code (${SCHEMA_VERSION}).`);
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  return {
    db,

    upsertTask(name, specHash, { parentId = null, depth = 0, origin = "hand" } = {}) {
      const existing = one("SELECT id FROM tasks WHERE name = ? AND parent_id IS ?", name, parentId);
      if (existing) {
        db.prepare("UPDATE tasks SET spec_hash = ? WHERE id = ?").run(specHash, existing.id);
        return existing.id;
      }
      return run(
        "INSERT INTO tasks (name, spec_hash, parent_id, depth, origin, created) VALUES (?, ?, ?, ?, ?, ?)",
        name, specHash, parentId, depth, origin, now(),
      );
    },

    // A changed test is a new step row, so results for different test versions never mix.
    upsertStep(taskId, ord, name, testHash) {
      const existing = one("SELECT id FROM steps WHERE task_id = ? AND name = ? AND test_hash = ?", taskId, name, testHash);
      if (existing) return existing.id;
      return run("INSERT INTO steps (task_id, ord, name, test_hash) VALUES (?, ?, ?, ?)", taskId, ord, name, testHash);
    },

    startRun({ taskId, model, roundsLimit, stepsTotal }) {
      return run(
        "INSERT INTO runs (task_id, model, started, rounds_limit, steps_total) VALUES (?, ?, ?, ?, ?)",
        taskId, model, now(), roundsLimit, stepsTotal,
      );
    },

    finishRun(runId, { result, stepsPassed }) {
      db.prepare("UPDATE runs SET finished = ?, result = ?, steps_passed = ? WHERE id = ?").run(now(), result, stepsPassed, runId);
    },

    startAttempt({ runId, stepId, round }) {
      return run("INSERT INTO attempts (run_id, step_id, round, started) VALUES (?, ?, ?, ?)", runId, stepId, round, now());
    },

    finishAttempt(attemptId, { result, testsPassed, testsTotal, durationMs, agentExit = null }) {
      db.prepare(
        "UPDATE attempts SET result = ?, tests_passed = ?, tests_total = ?, duration_ms = ?, agent_exit = ? WHERE id = ?",
      ).run(result, testsPassed, testsTotal, durationMs, agentExit, attemptId);
    },

    addVerification(attemptId, { command, exitCode, passed, failed, output }) {
      return run(
        "INSERT INTO verifications (attempt_id, command, exit_code, passed, failed, output_tail) VALUES (?, ?, ?, ?, ?, ?)",
        attemptId, command, exitCode, passed, failed, output.slice(-8000),
      );
    },

    addEvents(attemptId, events) {
      const insert = db.prepare(
        "INSERT INTO events (attempt_id, seq, agent_step, tool, path, outcome, kind, duration_ms, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const e of events) {
        insert.run(attemptId, e.seq, e.step ?? null, e.tool ?? null, e.path ?? null, e.outcome, e.kind ?? null, e.ms ?? null, e.detail ?? null);
      }
    },

    // For a passing attempt: the tool sequence that led to success, and credit for the model.
    recordSuccess(attemptId, { model, stepId, runId, round }) {
      const tools = db.prepare("SELECT tool FROM events WHERE attempt_id = ? AND tool IS NOT NULL ORDER BY seq").all(attemptId);
      const signature = tools.map((t) => t.tool).join("→") || "(no agent steps)";
      run("INSERT OR IGNORE INTO chains (attempt_id, signature) VALUES (?, ?)", attemptId, signature);
      run("INSERT OR IGNORE INTO credit (model, step_id, run_id, attempts_to_pass) VALUES (?, ?, ?, ?)", model, stepId, runId, round);
      return signature;
    },

    // Consistent copy via VACUUM INTO; keeps the newest `keep` snapshots.
    snapshot(backupDir, keep = 10) {
      mkdirSync(backupDir, { recursive: true });
      const target = join(backupDir, `knowledge-${now().replaceAll(":", "-").replace(/\..+$/, "")}.db`);
      rmSync(target, { force: true });
      db.prepare("VACUUM INTO ?").run(target);
      const old = readdirSync(backupDir).filter((f) => /^knowledge-.*\.db$/.test(f)).sort().slice(0, -keep);
      for (const f of old) rmSync(join(backupDir, f), { force: true });
      return target;
    },

    close() {
      db.close();
    },
  };
}
