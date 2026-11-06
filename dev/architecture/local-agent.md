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

## Logs and events

- `logs/terminal-output.log`: human-readable, overwritten per run.
- `AGENT_EVENTS=<file>` ✅: one JSON line per step (`seq`, `step`, `tool`, `path`, `outcome`,
  `kind`, `ms`, `detail`) for the knowledge DB ([knowledge-db.md](./knowledge-db.md)).
  `data/` is write-protected, so the model cannot alter its own record.

## Planned: atomic tools 📐

Every free choice is a chance for a small model to fail. A "TDD mode" would replace the broad
tools with narrow ones bound to the current step:

| Now | Atomic |
| --- | --- |
| `write_file(path, content)` | `replace_in_file(old, new)` on the one source file named by the task |
| `run_command(any)` | `run_tests()`: always the gate command |
| `read_file(path)` | `read_test()`, `read_source()` |
