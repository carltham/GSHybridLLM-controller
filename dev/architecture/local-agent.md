# Local agent (`scripts/agent.mjs`) ✅

A single Node script that lets a local Ollama model work on this project through a small
set of tools. No cloud account or dependency is needed.

## Loop

```
task ─► model reply (one JSON object) ─► tool call ─► result back to model ─► … (max 12 steps)
                                     └─► {"final": "..."} ─► verify gate ─► accepted / rejected
```

- Request: `POST /api/chat`, `format: "json"`, `keep_alive: "5m"`, `num_ctx: 16384`,
  `num_predict: 2048`, 10-minute timeout. Model from `LOCAL_MODEL` (default `qwen2.5-coder:3b`).
- A malformed reply gets an error that repeats the reply and shows the exact call shape.
- A final answer before any tool call is rejected.
- Exit code 1 when the run ends without an accepted final answer.

## Tools

| Tool | Approval | Limits |
| --- | --- | --- |
| `list_dir`, `read_file` | none | project root only; reads capped at 64 000 chars |
| `write_file` | `y/n` per write | 200 000 chars; content starting with a ``` fence is rejected |
| `run_command` | `y/n/a`, or exact match in `.ollama/allowlist.json` | 120 s, then SIGTERM to the process group, SIGKILL 10 s later; output capped at 8 000 chars |

A denied command is answered with the exact allowed test command when `AGENT_VERIFY` is set.

## Path rules

- Paths resolve inside the project root (symlinks and `..` resolved).
- Blocked for all access: `.git`, `node_modules`, `.env*`.
- Write-protected: `scripts/agent.mjs`, `.ollama/`, `data/`, `dev/testing/`, and every path in
  `AGENT_READONLY`. The protection list can only grow; nothing can lift it.

## Settings (environment)

| Variable | Purpose |
| --- | --- |
| `LOCAL_MODEL` | Ollama model tag |
| `OLLAMA_PORT` | Port of the local model server (default 11434); the host is always `127.0.0.1`. Used by tests with a fake model |
| `AGENT_ANSWERS` | Pre-written approvals: lines `write: y\|n`, `run: y\|n\|a`; read once at start, kept per kind, missing answer = no |
| `AGENT_VERIFY` | Allow-listed command that must exit 0 before a final answer is accepted |
| `AGENT_READONLY` | Comma-separated project paths added to write protection |
| `AGENT_EVENTS` | File for structured step events (JSON lines) |
| `AGENT_TARGET`, `AGENT_TESTS` | Switch on TDD mode: the one source file and the test folder |
| `AGENT_TEMPERATURE` | Sampling temperature 0–2 (runner default 0.2); unset = model default |
| `AGENT_WORKDIR` | Project-relative folder the verify command runs in (the game); default the project root |
| `AGENT_LOG` | Log file instead of `logs/terminal-output.log` (set by the runner) |

## Logs and events

- `logs/terminal-output.log` (or `AGENT_LOG`): human-readable, overwritten per run.
- `AGENT_EVENTS=<file>` ✅: one JSON line per step (`seq`, `step`, `tool`, `path`, `outcome`,
  `kind`, `ms`, `detail`) for the knowledge DB ([knowledge-db.md](./knowledge-db.md)).
  `data/` is write-protected, so the model cannot alter its own record.

## TDD mode: atomic tools ✅

Every free choice is a chance for a small model to fail. With `AGENT_TARGET` (one source file)
and `AGENT_TESTS` (one test folder) set, and `AGENT_VERIFY` required, the agent offers only:

| Tool | Does | Replaces |
| --- | --- | --- |
| `read_test {}` | Shows all test files in `AGENT_TESTS` | `read_file(path)` |
| `read_source {}` | Shows the target file | `read_file(path)` |
| `replace_in_file {old, new}` | Replaces one exact, unique piece of text (approval as a write) | `write_file(path, …)` |
| `write_source {content}` | Replaces the whole target file (approval as a write) | `write_file(path, …)` |
| `run_tests {}` | Runs `AGENT_VERIFY` | `run_command(any)` |

The model cannot name a path or a command. Broad tools are answered as `unknown-tool`.
New failure kinds: `replace-no-match`, `replace-ambiguous`, `regression`. Writes still pass
through the path rules and the fence check. The sample runner always uses TDD mode.

**Regression guard.** After every write the agent runs `AGENT_VERIFY` and compares passing
test names (node:test TAP `ok N - name`, Playwright list `✓ N … (time)`) with those of the
source before the write. If any passing test now fails, the previous source is restored and
the model is told which tests broke (event `rejected`, kind `regression`). This keeps earlier
steps green (run 11: each fix for hangman `02b` broke `02a`). Cost: one test run per write
(two for the first write of an attempt). The Playwright pattern is not yet covered by a test.
