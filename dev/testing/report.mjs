// Prints a summary of the knowledge DB: furthest step per model and task, failure kinds,
// success chains and recent runs. Read-only.
// Usage: node dev/testing/report.mjs [path/to/knowledge.db]
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = process.argv[2] ?? join(root, "data", "knowledge.db");
if (!existsSync(file)) throw new Error(`No knowledge DB at ${file}. Run dev/testing/run-sample.mjs first.`);
const db = new DatabaseSync(file, { readOnly: true });

const table = (title, rows) => {
  console.log(`\n## ${title}`);
  if (rows.length === 0) return console.log("(none)");
  console.table(rows.map((row) => ({ ...row })));
};

table("Furthest step per model and task", db.prepare(`
  SELECT r.model, t.name AS task, MAX(r.steps_passed) AS best_steps, MAX(r.steps_total) AS steps,
         COUNT(*) AS runs
  FROM runs r JOIN tasks t ON t.id = r.task_id
  GROUP BY r.model, t.name ORDER BY t.name, best_steps DESC`).all());

table("Rounds needed per step (credit)", db.prepare(`
  SELECT c.model, t.name AS task, s.name AS step, MIN(c.attempts_to_pass) AS best_round, COUNT(*) AS times_solved
  FROM credit c JOIN steps s ON s.id = c.step_id JOIN tasks t ON t.id = s.task_id
  GROUP BY c.model, t.name, s.name ORDER BY t.name, s.ord, c.model`).all());

table("Failure kinds per model", db.prepare(`
  SELECT r.model, e.kind, COUNT(*) AS count
  FROM events e JOIN attempts a ON a.id = e.attempt_id JOIN runs r ON r.id = a.run_id
  WHERE e.outcome <> 'ok' OR e.kind IS NOT NULL
  GROUP BY r.model, e.kind ORDER BY r.model, count DESC`).all());

table("Success chains", db.prepare(`
  SELECT ch.signature, COUNT(*) AS count FROM chains ch GROUP BY ch.signature ORDER BY count DESC LIMIT 15`).all());

table("Recent runs", db.prepare(`
  SELECT r.id, r.model, t.name AS task, r.started, COALESCE(r.result, 'ABORTED') AS result,
         r.steps_passed || '/' || r.steps_total AS steps
  FROM runs r JOIN tasks t ON t.id = r.task_id ORDER BY r.id DESC LIMIT 10`).all());

db.close();
