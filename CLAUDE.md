# CLAUDE.md

Guidance for AI assistants working in this repository. See [README.md](./README.md)
for the full workflow and [WHAT_IS_THIS_GOOD_FOR.md](./WHAT_IS_THIS_GOOD_FOR.md)
for scope and current status.

## Project

Standalone terminal prototype that orchestrates two models: Copilot (cloud)
proposes a short, bounded task plan; Ollama (local) drafts text suggestions.
It is not a merged model and is separate from GSAccount.

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
npm test             # build + node --test dist/dev/testing/unit/controller.test.js
npm start -- --help  # run CLI (dist/src/cli/index.js)
npm audit
```

## Layout

- `src/core/controller.ts`: approval gates, Copilot planning, Ollama calls, limits
- `src/cli/index.ts`: terminal interface
- `dev/testing/unit/controller.test.ts`: mocked tests (no network, auth, or live inference)
- `dev/testing/specs/<name>/`: top-down TDD specs for the local agent (tests + `task.txt`)

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

Ollama's systemd override sets `OLLAMA_MODELS=/mnt/STORAGE/ollama` and keeps
`OLLAMA_CONTEXT_LENGTH=16384`; verify with `systemctl show ollama`. The previous
model directory `/mnt/DATA/ollama_models` was empty and nothing was copied or
deleted from it. Do not change the service without explicit go-ahead.

Runtime validation's test parser does not recognize Node's test-count format; confirm
the 9 controller tests with a direct `node --test`.

Top-down TDD samples: `dev/testing/specs/<name>/` (tracked) holds the tests and `task.txt`.
`node dev/testing/run-sample.mjs <name>` deletes `dist/testing/<name>/` (git-ignored output),
copies the specs in and runs the local agent. The model cannot write `dev/testing/`.
`AGENT_ANSWERS=<file>` gives pre-written approvals (`write: y`, `run: n`; missing → no).
There is no CI; tests are run locally.
