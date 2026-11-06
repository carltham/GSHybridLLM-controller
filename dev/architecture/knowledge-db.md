# Knowledge database ✅

Records every agent run as structured data, so success and failure can be counted, compared
across models and replayed. It replaces the plain-text run logs as the source of truth.

## Goals

1. **Each tool step** recorded as success or failure, with a failure kind.
2. **Success chains:** the full step sequence of every round that ended with passing tests.
3. **Failure points:** where a failing round went wrong (first error, or the last code change
   before failing tests), with the code written and the test output.
4. **Model comparison:** steps passed, rounds needed and failure kinds per model and game.
5. **Reuse:** success chains can be fed back as worked examples (and later as training data).

## Storage

- **Location:** inside this project, `data/knowledge.db` (SQLite).
- **Engine:** Node's built-in `node:sqlite` (no new dependency; still marked experimental in
  Node 22). Fallback: `better-sqlite3` as a dev-only dependency.
- **Write access:** only the runner and agent code. `data/` is added to the agent's
  write-protected paths, so a model cannot alter its own record.
- **Never exported to GitHub.** `data/` is git-ignored; run knowledge stays on this machine.
- **Savable through local snapshots.** After each run the runner writes a consistent copy with
  SQLite `VACUUM INTO` to `data/backups/knowledge-<timestamp>.db` and keeps the newest N
  (default 10). Restoring = copying a snapshot back to `data/knowledge.db`.

## Schema (EBS-Brain vocabulary)

Names follow GS-EBS-Brain's learning system so the store can move there unchanged
(see [ebs-brain-alignment.md](./ebs-brain-alignment.md)).

```
tasks          id, name (game), spec_hash, created
steps          id, task_id, ord, name (e.g. 02-hit), test_hash
runs           id, task_id, model, started, finished, rounds_limit, result, steps_passed, steps_total
attempts       id, run_id, step_id, round, started, duration_ms, result (PASS|FAIL), tests_passed, tests_total
events         id, attempt_id, seq, tool, path, outcome (ok|error|denied|rejected), kind, duration_ms, detail
verifications  id, attempt_id, command, exit_code, passed, failed, output_tail
chains         id, attempt_id, signature (e.g. read_file→write_file→run_command→final)   -- passing attempts
credit         id, model, step_id, attempts_to_pass, first_pass_run_id                   -- who solved what
```

Failure `kind` values: `fence`, `protected-path`, `blocked-path`, `bad-args`, `io-error`,
`denied-write`, `denied-command`, `bad-json`, `unknown-tool`, `no-tool-before-final`,
`verify-failed`, `nonzero-exit`, `timeout`, `step-limit`, `conversation-limit`
(📐 `wrong-file` once atomic tools name the target file).

## Example queries

```sql
-- Furthest step per model and task
SELECT r.model, t.name, MAX(r.steps_passed) FROM runs r JOIN tasks t ON t.id = r.task_id GROUP BY 1, 2;

-- Most common failure kinds per model
SELECT r.model, e.kind, COUNT(*) FROM events e
JOIN attempts a ON a.id = e.attempt_id JOIN runs r ON r.id = a.run_id
WHERE e.outcome <> 'ok' GROUP BY 1, 2 ORDER BY 3 DESC;

-- Success chains and how often each occurs
SELECT signature, COUNT(*) FROM chains GROUP BY signature ORDER BY 2 DESC;
```

## Implementation ✅

1. The agent writes one JSON line per step to `AGENT_EVENTS`
   (`data/events/attempt-<id>.jsonl`, write-protected); it has no database code.
2. The runner owns the database (`dev/testing/knowledge-db.mjs`): schema (versioned with
   `PRAGMA user_version`), tasks/steps (a changed test is a new step row), runs, attempts
   (round 0 = check before any agent round), verifications with parsed test counts, events;
   `chains` and `credit` are derived for each passing attempt. Snapshot after every run.
3. `node dev/testing/report.mjs` prints furthest step, rounds needed, failure kinds,
   success chains and recent runs.
4. Unit tests: `dev/testing/unit/knowledge-db.test.mjs` (part of `npm test`).

Not yet built: reuse of chains as examples, and the task-tree columns in use
(`parent_id`, `depth`, `origin` exist but are always root/0/`hand`).

Node prints an `ExperimentalWarning` for `node:sqlite`; this is expected.
