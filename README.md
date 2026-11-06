# GSHybridLLM controller

A standalone, terminal-only development assistant. Copilot plans bounded tasks;
Ollama produces suggestions locally. This is orchestration, not a merged model.
It is separate from GSAccount and its bookkeeping suggestion feature.

## Current scope

1. Enter a non-sensitive task description. Do not enter source code or secrets.
2. Review that exact request and type `SEND` to permit the cloud session.
3. Review the cloud's one to three independent instructions and type `RUN`.
4. Enter optional local-only context, ending with `.end`.
5. Read the local model's answers. They are unverified text suggestions.

No file reading/writing, shell execution, model downloads or automatic uploads
are implemented. The controller does not run tests on generated suggestions.
There is no automatic escalation or cloud review of local answers.

## Local agent (`scripts/agent.mjs`)

Ollama as a local tool that needs no Copilot authentication. It talks only to
`127.0.0.1` (port 11434; `OLLAMA_PORT` exists for test fakes) with `LOCAL_MODEL`
(default `qwen2.5-coder:3b`), and the model replies with one JSON tool call per step,
up to 12 steps.

```bash
node scripts/agent.mjs "your task"
```

- `read_file` and `list_dir` run without a prompt.
- `write_file` asks `y/n` after showing the path, size and a preview.
- `run_command` asks `y/n/a`; `a` saves the exact command string to
  `.ollama/allowlist.json` (git-ignored), and that exact string then runs unprompted.
- Paths are confined to the project root (symlinks and `..` resolved); `.git`,
  `node_modules` and `.env*` are blocked. The model cannot write `scripts/agent.mjs`,
  `.ollama/` (allowlist), `data/` (its own records), `dev/testing/` (tests and specs)
  or any path in `AGENT_READONLY`.
- Commands time out after 120 s and output is capped. The run is logged to
  `logs/terminal-output.log` (overwritten each run).
- Uses `keep_alive: 5m` so the model is not reloaded at every step.

Small models can ignore the protocol; a `final` answer before any tool call is
rejected, and with `AGENT_VERIFY` a final answer is only accepted once that test
command passes. The model is not a sandbox: review each approval prompt.

**TDD mode** (`AGENT_TARGET` + `AGENT_TESTS`): the model gets only atomic tools bound to
one source file (`read_test`, `read_source`, `replace_in_file`, `write_source`,
`run_tests`) and cannot name paths or commands.

**Sample games** are built test-first with `node dev/testing/run-sample.mjs <game>`
(specs in `dev/testing/specs/`, output in `dist/games/`), step by step with several agent
rounds per step. Every run is recorded in `data/knowledge.db` (local only, snapshots in
`data/backups/`); `node dev/testing/report.mjs` compares models. Details:
`dev/architecture/`.

`scripts/list-models.mjs` prints Copilot auth status and model IDs (read-only).

## Setup

Requires Node.js ^20.19.0 or >=22.12.0, local Ollama at
`http://127.0.0.1:11434`, and GitHub authentication with Copilot access.

```bash
npm ci
npm run build
npm start -- --help
```

The pinned Copilot SDK includes its runtime; a separate CLI is not required by
this release. Authentication is not inherited merely because VS Code is signed
in. Configure it locally using a supported SDK/CLI authentication mechanism.
Do not paste or save tokens in this project.

Choose an exact cloud model ID available to your Copilot account. Install a local
coding model separately, only when ready; no model has been installed by this
project. Example launch with an already installed model:

```bash
export CLOUD_MODEL='your-available-copilot-model-id'
export LOCAL_MODEL='qwen2.5-coder:7b'
npm start
```

Unavailable authentication, models and services produce explicit errors.
Live authentication and end-to-end inference still require user verification.

## Memory on Hydra

Hydra has 31 GiB system RAM and a GTX 1050 with 4 GiB VRAM. Start with a quantized
7B coding model and measure speed. Ollama chooses GPU/CPU placement; partial
offloading can use both GPU memory and CPU/system RAM, but is slower than full
GPU execution. The cloud model cannot allocate memory or change service settings.

Local requests use a 16384-token context setting, at most 2048 generated tokens,
a ten-minute timeout and unload-after-request (`keep_alive: 0`). Character limits
are input safety limits, not a guarantee that all context fits the token window.
Keep local context focused. During inference, `ollama ps` shows model placement.
The configured model-storage location is `/mnt/STORAGE/ollama`.

## Cloud boundary

The cloud receives the approved non-sensitive task description and the fixed
supervisor instructions. It also receives ordinary SDK/provider metadata.
Only the local Ollama request receives local context. Local answers are printed,
not returned to Copilot. Approval is not a secret detector: do not put sensitive
data in the cloud request.

Copilot runs in empty mode with no tools, all permission requests denied,
discovery/hooks/skills/git context disabled, and session-store and optional
session telemetry disabled. Runtime state uses a dedicated random directory
under the operating system temporary directory, not a project working directory.
Sessions are deleted and the runtime stopped after planning; SDK configuration
and residual runtime files may remain in that temporary directory. Normal
provider-side processing/retention and runtime-level telemetry are not controlled
by this application. This is an application-level boundary, not an OS sandbox.

## Validation

```bash
npm test
npm audit
```

Tests never authenticate, call cloud models, download models or invoke live local
inference. Controller tests mock both providers and cover approval gates, task/input
limits, local/cloud separation, disabled cloud capabilities and Ollama errors.
Knowledge-DB unit tests use temporary SQLite files. Acceptance tests run the real sample
runner and agent against a fake model on `127.0.0.1` with a temporary DB; they cover the
verify gate, recorded chains and credit, refused writes and TDD mode. Tests run serially.
The runtime eval plan also builds and checks CLI help without network calls.

The SDK currently pins an affected Zod release. `package.json` overrides it to
4.6.6 to address GHSA-mrhx-c7xc-m3w5 (memory exhaustion); the lockfile records the
patched resolution. Compatibility must remain covered by build and tests.

`skipLibCheck` avoids an incompatible optional-property declaration in SDK 1.0.28
(`SessionDeletedEvent.metadata`). Application code is still checked with strict
mode and exact optional-property types.
