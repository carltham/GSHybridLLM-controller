# What is this good for?

This project gives a local Ollama model a small set of controlled tools, so it can
work on a project folder on your machine. Whichever cloud AI you use in your editor
stays in charge. Ollama is a local helper, not a replacement for it.

There are two parts. They are orchestration between separate models, not a merged
model, and they are separate from GSAccount.

- **`scripts/agent.mjs`** is the local agent. It is the main part and needs no cloud
  account.
- **`src/`** is the Copilot controller, a terminal prototype where Copilot proposes
  a short plan and Ollama drafts local text suggestions. It needs Copilot
  authentication.

## What the local agent can do

A local model (default `qwen2.5-coder:3b`) takes a task and works in steps. At each
step it asks for one tool:

| Tool | What it does | Approval |
| --- | --- | --- |
| `list_dir` | List a folder in the project | None |
| `read_file` | Read a file in the project | None |
| `write_file` | Create or overwrite a file | You confirm each write (`y/n`) |
| `run_command` | Run a shell command | You confirm (`y/n/a`); `a` allow-lists that exact command |

Everything stays on your machine. The model talks only to `127.0.0.1:11434`, and
paths are confined to the project folder (`.git`, `node_modules` and `.env*` are
blocked).

## Good uses

- **Private work.** Your code and prompts never leave the machine.
- **Cheap, repetitive chores.** Listing files, summarizing a folder, drafting small
  files, running a known command such as `npm test` and reporting the result.
- **Offline use.** It works without an internet connection or cloud quota.
- **A local helper for a cloud AI.** The cloud AI can hand the local model a bounded
  chore and read the log in `logs/terminal-output.log`.
- **Learning how agent loops work.** The whole thing is one readable script.

## Not good for

- **Hard reasoning or large refactors.** A 3B model is small. It can skip tools,
  guess, or give a confident wrong answer. The agent rejects a final answer given
  before any tool call, but it cannot check that an answer is correct.
- **Unattended work.** It is meant to be supervised. Read every approval prompt.
- **Sandboxing.** The approvals and path checks reduce risk but are not an OS
  sandbox. An approved command runs with your user's permissions.
- **Speed with large models.** Ollama chooses GPU/CPU placement. A model too big for
  the GPU is partly offloaded to the CPU and runs slower.

## The Copilot controller (`src/`)

A bounded, approval-gated workflow:

1. You enter a non-sensitive task description.
2. You review the exact request and type `SEND` to allow the cloud session.
3. Copilot returns one to three independent instructions, and you type `RUN`.
4. You can add local-only context. It goes to Ollama only.
5. Ollama's answers are printed as unverified text suggestions.

Guarantees it keeps:

- Nothing goes to Copilot without `SEND`, and Ollama is not called without `RUN`.
- Local context and local answers are never passed to Copilot.
- No file access, edits, shell execution, model downloads or automatic cloud
  escalation. Errors stop the run and never fall back from local to cloud.
- Copilot runs with no tools, all permissions denied, and discovery, hooks, skills,
  git and telemetry disabled.
- Ollama requests use loopback only, size limits, a timeout, a 16384-token context,
  at most 2048 generated tokens, and unload after each request.

Approval is not a secret detector. Do not put secrets or source code in the cloud
request. This is an application-level boundary, not an OS sandbox.

## Status

- The agent has been run live for listing files and for an approved file write. The
  `run_command` prompt and the allow list have not been exercised yet.
- The controller is verified with a strict TypeScript build, 9 mocked Node tests, CLI
  `--help`, and a clean `npm audit` (a vulnerable transitive `zod` is overridden).
- The controller's live Copilot authentication, cloud planning and live Ollama
  inference are untested. Authentication is not inherited just because an editor is
  signed in, and no token should be pasted into chat or saved in the project.

## How to use it

```bash
node scripts/agent.mjs "your task"
```

Treat the output as a suggestion and check it with `git diff` before you keep it.
See the README for the limits, the allow list and the logging.
