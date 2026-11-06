# Copilot controller (`src/`) 🧪

A terminal prototype where GitHub Copilot proposes a short, bounded plan and a local Ollama
model drafts text for each step. Orchestration only; not a merged model. Live Copilot
authentication, cloud planning and live inference are untested; build, mocked tests and
`--help` are verified.

## Layout

| Path | Role |
| --- | --- |
| `src/cli/index.ts` | Terminal interface (`npm start`) |
| `src/core/controller.ts` | Approval gates, Copilot planning, Ollama calls, limits |
| `dev/testing/unit/controller.test.ts` | 9 mocked tests (no network, auth or inference) |

## Flow

```
task description ─► SEND approval ─► Copilot (no tools) ─► 1–3 instructions
                 ─► RUN approval  ─► Ollama (+ optional local-only context) ─► printed suggestions
```

## Invariants

- `SEND` before anything goes to Copilot; separate `RUN` before Ollama is called.
- Local context and local answers are never passed to Copilot.
- No file access, edits, shell execution, model downloads or automatic cloud escalation.
  Errors propagate; never a fallback from local to cloud.
- Copilot session: no tools, permissions denied, discovery/hooks/skills/git/session-store/
  telemetry disabled.
- Ollama: loopback only, input/response size bounds, inference timeout, `keep_alive: 0`,
  `num_ctx` 16384, at most 2048 tokens.
- Strict TypeScript with exact optional property types; `skipLibCheck` for an SDK 1.0.28
  declaration issue; `zod` override 4.6.6 (GHSA-mrhx-c7xc-m3w5) must remain.

## Relation to the rest

The local agent and the sample runner do not use this controller. A future planner that
reacts to local test results cannot be built on the controller, because local results must
never reach Copilot.
