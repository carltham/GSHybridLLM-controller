# Sample runner and specs (`dev/testing/`) ✅

Builds freestanding sample games with the local agent, test-first and top-down.

## Spec layout

```
dev/testing/specs/<game>/          tracked
├── task.txt                       what to build (no tool or path names)
├── verify.txt                     gate command (must be in .ollama/allowlist.json)
├── target.txt                     the one source file the agent may change (under src/)
├── game/                          freestanding scaffold: package.json, README, configs, src/ starter
└── steps/                         ordered step tests: 01-….test.mjs / 01-….spec.mjs
```

Current specs: `guess-game` (5 steps), `hangman` (6), `tictactoe` (4, React + Vite + Playwright).
Each spec was checked against a reference implementation before use.

## Run (`node dev/testing/run-sample.mjs <game>`)

```
delete dist/games/<game> ─► copy game/ ─► npm ci (if lockfile)
for each step (sorted):
    add step test to dist/games/<game>/test/      (earlier steps stay)
    run verify ── pass ─► next step
              └─ fail ─► up to SAMPLE_ROUNDS agent rounds (default 3):
                         fresh conversation, current code kept,
                         task = task.txt + current source + new step test + test output
                         still failing after all rounds ─► stop, exit 1
all steps pass ─► exit 0
```

- The agent gets `AGENT_VERIFY` (= `verify.txt`), `AGENT_TARGET` (= `target.txt`) and
  `AGENT_TESTS` (= the game's `test/`), which switch on TDD mode, `AGENT_TEMPERATURE`
  (`SAMPLE_TEMPERATURE`, default 0.2), `AGENT_EVENTS` (per attempt, in `data/events/`) and
  `AGENT_READONLY` (= everything copied from the scaffold except `src/`, plus `test/`).
- Run log: `logs/sample-<game>.log` (summary plus each round's agent log).
- Every run is recorded in the knowledge DB (`SAMPLE_DATA_DIR`, default `data/`).

## Tests of the tooling itself ✅

Top-down as well. Outer layer: `dev/testing/acceptance/sample-run.test.mjs` runs the real runner
and agent against a fake local model (scripted replies on `127.0.0.1`, `OLLAMA_PORT`) with a
temporary `SAMPLE_DATA_DIR`. It covers a correct model (all steps pass; chain and credit
recorded), a model that only claims success (rejected; no credit) and refused writes (`fence`;
a broad `write_file` to a test is `unknown-tool`; tests unchanged). `tdd-mode.test.mjs` covers TDD mode: starter file, offered tools, task context, temperature,
`replace_in_file` success and refused broad tools. Inner layer: `dev/testing/unit/`. All part of
`npm test`, run with `--test-concurrency=1` because the acceptance tests share
`dist/games/guess-game/`.
Note: the acceptance tests rebuild `dist/games/guess-game/` and overwrite
`logs/sample-guess-game.log`.

## UI games

`tictactoe` runs Vite **inside** the Playwright process (`playwright.global-setup.mjs`), so a
killed test run cannot leave a server holding port 5179. Playwright is pinned to 1.63.0, the
newest version whose Chromium is already cached on Hydra. Test timeout 5 s, expect 2 s.

## Results so far

Before step 2 (broad tools, no starter files, default temperature):

| Game | `qwen2.5-coder:3b` | `qwen3.5:4b` (run stopped by the user) |
| --- | --- | --- |
| guess-game | step 1 ✅, step 2 ❌ | step 1 ✅ (round 3), step 2 ✅ (round 1), step 3 ❌ after 2 rounds |
| hangman | step 1 ❌ | not run |
| tictactoe | step 1 ❌ | not run |

No real-model run with TDD mode yet. New runs are recorded in the knowledge DB
(`node dev/testing/report.mjs`).

Typical 3B failures: placeholder code, CommonJS in an ES-module package, `async` or
`console.log` instead of returning lines, markdown fences, writing to the wrong file, bare
JSX without a component, attempts to edit protected test files (blocked).

## Built in step 2 ✅

- Starter file in `game/src/` with the correct export shape (named by `target.txt`).
- The agent runs in TDD mode (atomic tools, see [local-agent.md](./local-agent.md)).
- Each round's task contains the current source and the new step test (marked with
  `--- name ---` lines, not fences) plus the latest test output.
- Temperature 0.2 (`SAMPLE_TEMPERATURE` to override).

## Planned 📐

- Micro-steps (one assertion per step) if models still stall.
- A planner (cloud AI or larger local model) that writes and validates new step tests.
