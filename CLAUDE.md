# CLAUDE.md

Guidance for AI assistants working in this repository. See [README.md](./README.md)
for the full workflow and [WHAT_IS_THIS_GOOD_FOR.md](./WHAT_IS_THIS_GOOD_FOR.md)
for scope and current status.

## Project

Lets local Ollama models do supervised work on this machine and measures how well they
do it. Two parts: the local agent (`scripts/agent.mjs`, the main part, no cloud
dependency) with a test-first sample runner and knowledge DB; and a Copilot controller
prototype (`src/`) where Copilot proposes a short, bounded plan and Ollama drafts text
suggestions. Not a merged model; separate from GSAccount. It prototypes the learning
logic for GS-EBS-Brain (see `dev/architecture/`).

## Working style

- Proceed one step at a time: give one small, clearly explained action, wait for
  the result, then decide the next. Do not provide long command sequences.
- Do not install models, change the Ollama service, or start a cloud session
  without the user's explicit go-ahead.
- Check current state (`ollama list`, `ollama ps`) before relying on the notes
  below.

## Commands

```bash
npm ci               # install
npm run build        # strict tsc build to dist/
npm test             # build + all tests (controller, DB unit, acceptance), serially
npm start -- --help  # run CLI (dist/src/cli/index.js)
npm audit
```

## Layout

- `src/core/controller.ts`: approval gates, Copilot planning, Ollama calls, limits
- `src/cli/index.ts`: terminal interface
- `scripts/agent.mjs`: local agent (broad tools, or TDD mode with atomic tools)
- `dev/testing/run-sample.mjs`: sample runner (steps × rounds, records to the knowledge DB)
- `dev/testing/knowledge-db.mjs`, `dev/testing/report.mjs`: knowledge DB and its report
- `dev/testing/unit/`: controller tests (mocked) and knowledge-DB tests
- `dev/testing/acceptance/`: outer-layer tests with a fake loopback model
- `dev/testing/specs/<name>/`: freestanding sample-game specs for the local agent
- `data/`: knowledge DB and snapshots (git-ignored, never exported to GitHub)
- `dev/architecture/`: architecture docs (start at `README.md`; ✅ implemented, 📐 planned)

## Local agent (`scripts/agent.mjs`)

The user wants Ollama to be a local tool for whichever cloud AI is in use, with
no Copilot dependency. The agent has file read/write and command execution:
writes and commands need approval; commands are allow-listed by exact string in
`.ollama/allowlist.json`; paths are confined to the project root. Do not weaken
these checks. The invariants below describe `src/` (the Copilot controller) only.

## Invariants to preserve

- Explicit `SEND` approval before anything goes to Copilot; separate `RUN`
  approval before Ollama is called.
- Optional local context goes to Ollama only; local results and context are never
  passed to Copilot.
- No file access, code edits, shell execution, model downloads, or automatic
  cloud escalation. Errors propagate; never fall back from local to cloud.
- Copilot sessions run with no tools, permissions denied, and
  discovery/hooks/skills/git/session-store/telemetry disabled.
- Ollama endpoint stays loopback (`http://127.0.0.1:11434`); keep input/response
  size bounds, inference timeout, `keep_alive: 0`, 16384 context, max 2048 tokens.
- TypeScript stays strict (exact optional property types). `skipLibCheck` is
  intentional (SDK 1.0.28 declaration issue); the `zod` override (4.6.6) in
  `package.json` fixes GHSA-mrhx-c7xc-m3w5 and must remain.

## Security

- Never ask for, paste, or save tokens in chat or in the project.
- Approval is not a sensitive-data detector; do not put secrets or source code in
  cloud requests.

## Known gaps

Live Copilot authentication, cloud planning, and live Ollama inference are
untested; only mocks, build, and CLI help are validated.

## Local environment (Hydra)

31 GiB RAM, GTX 1050 (4 GiB VRAM), Ollama models stored in `/mnt/STORAGE/ollama`.
`qwen2.5-coder:3b` is installed (1.9 GB) and runs 100% on the GPU at 16384 context.
`qwen3.5:4b` is installed (3.3 GB) and runs about 68% GPU / 32% CPU (~12 tokens/s).

Ollama's systemd override sets `OLLAMA_MODELS=/mnt/STORAGE/ollama` and keeps
`OLLAMA_CONTEXT_LENGTH=16384`; verify with `systemctl show ollama`. The previous
model directory `/mnt/DATA/ollama_models` was empty and nothing was copied or
deleted from it. Do not change the service without explicit go-ahead.

Runtime validation's test parser does not recognize Node's test-count format; confirm
the 9 controller tests with a direct `node --test`.

Top-down TDD sample games: each game is freestanding (own folder, `package.json`,
tests, dependencies), never sharing the root `package.json`; this project is only the
creator. Spec layout: `dev/testing/specs/<name>/{task.txt,verify.txt,target.txt,game/,steps/}`, where
`game/` is the scaffold and `steps/` holds ordered step tests (`01-….test.mjs`).
`node dev/testing/run-sample.mjs <name>` deletes `dist/games/<name>/` (git-ignored), copies
`game/`, runs `npm ci` if there is a lockfile, then adds one step test at a time (earlier
ones stay). Each failing step gets up to `SAMPLE_ROUNDS` (default 3) fresh agent runs of
12 steps, each given the current test output. Summary and agent logs: `logs/sample-<name>.log`.
The model cannot write `dev/testing/`, `test/`, or anything copied from the scaffold except
`src/` (`AGENT_READONLY`). `AGENT_VERIFY` (= `verify.txt`, must be allow-listed) must exit 0
before a final answer is accepted. `AGENT_ANSWERS=<file>` gives pre-written approvals
(`write: y`, `run: n`; missing → no). Runs are recorded in `data/knowledge.db` (SQLite,
git-ignored, never exported to GitHub, snapshots in `data/backups/`); `node
dev/testing/report.mjs` summarizes. `npm test` also runs `dev/testing/unit/*.test.mjs` and the acceptance tests
`dev/testing/acceptance/*.test.mjs` (fake model via `OLLAMA_PORT`, temp DB via
`SAMPLE_DATA_DIR`), serially (`--test-concurrency=1`). Work strictly top-down TDD: failing
acceptance test first. The runner uses the agent's TDD mode: `target.txt` names the one
source file (starter in `game/src/`); tools `read_test`, `read_source`, `replace_in_file`,
`write_source`, `run_tests`; temperature 0.2. Writes starting with a ``` fence are rejected.
Commands get SIGTERM on timeout, then SIGKILL. tictactoe (React + Vite) uses Playwright
1.63.0 (matches the cached Chromium) with Vite started in-process by
`playwright.global-setup.mjs`, so no server outlives a killed test run.
There is no CI; tests are run locally.
