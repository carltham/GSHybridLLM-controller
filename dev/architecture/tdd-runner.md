# Sample runner and specs (`dev/testing/`) ✅

Builds freestanding sample games with the local agent, test-first and top-down.

## Spec layout

```
dev/testing/specs/<game>/          tracked
├── task.txt                       what to build and which single file to write
├── verify.txt                     gate command (must be in .ollama/allowlist.json)
├── game/                          freestanding scaffold: package.json, README, configs, (src stubs)
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
                         fresh conversation, current code kept, task = task.txt + step + test output
                         still failing after all rounds ─► stop, exit 1
all steps pass ─► exit 0
```

- The agent gets `AGENT_VERIFY` (= `verify.txt`) and `AGENT_READONLY` (= everything copied from
  the scaffold except `src/`, plus `test/`).
- Run log: `logs/sample-<game>.log` (summary plus each round's agent log).
- Every run is recorded in the knowledge DB (`SAMPLE_DATA_DIR`, default `data/`).

## Tests of the tooling itself ✅

Top-down as well. Outer layer: `dev/testing/acceptance/sample-run.test.mjs` runs the real runner
and agent against a fake local model (scripted replies on `127.0.0.1`, `OLLAMA_PORT`) with a
temporary `SAMPLE_DATA_DIR`. It covers a correct model (all steps pass; chain and credit
recorded), a model that only claims success (rejected; no credit) and refused writes (`fence`,
`protected-path`; tests unchanged). Inner layer: `dev/testing/unit/`. All part of `npm test`.
Note: the acceptance tests rebuild `dist/games/guess-game/` and overwrite
`logs/sample-guess-game.log`.

## UI games

`tictactoe` runs Vite **inside** the Playwright process (`playwright.global-setup.mjs`), so a
killed test run cannot leave a server holding port 5179. Playwright is pinned to 1.63.0, the
newest version whose Chromium is already cached on Hydra. Test timeout 5 s, expect 2 s.

## Results so far

| Game | `qwen2.5-coder:3b` | `qwen3.5:4b` |
| --- | --- | --- |
| guess-game | step 1 ✅, step 2 ❌ | running |
| hangman | step 1 ❌ | running |
| tictactoe | step 1 ❌ | running |

Typical 3B failures: placeholder code, CommonJS in an ES-module package, `async` or
`console.log` instead of returning lines, markdown fences, writing to the wrong file, bare
JSX without a component, attempts to edit protected test files (blocked).

## Planned 📐

- Starter files in `game/src/` with the correct export shape.
- Current source and step test included directly in each round's task.
- Lower sampling temperature for the agent.
- Micro-steps (one assertion per step) if models still stall.
- A planner (cloud AI or larger local model) that writes and validates new step tests.
