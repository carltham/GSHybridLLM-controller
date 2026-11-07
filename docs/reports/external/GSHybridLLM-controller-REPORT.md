# GSHybridLLM-controller: Project Report

2026-11-07 · Carl Sundvisson

## Summary

GSHybridLLM-controller is a working, small-scale prototype of GS-EBS-Brain's learning loop: local Ollama models write code test-first, a deterministic runner verifies it, and every attempt is recorded in a SQLite knowledge database. Built over 7 commits (2026-11-06 to 2026-11-07), it has 8 real-model runs on 3 sample games.

- **Model size decides whether it works at all.** `qwen3.5:4b` passed 10 of 15 steps; `qwen2.5-coder:3b` passed 1 of 15.
- **Narrow tools and an independent verify gate are what made small models usable.** The 3B model claimed success without running tests until the gate was added.
- **Creating a program costs about 3 × 10⁸ times more than running it** (581 s to learn, about 2 µs per call), which argues for learning once and storing verified programs.
- **Most of the forward design is planned, not built:** task tree, program neurons, rewards and reputation.
- **The project is written for GS-EBS-Brain to read**, using EBS vocabulary, but GS-EBS-Brain does not reference it yet.

## What it does

The project has two parts: a local agent (the main part, no cloud dependency) and a separate Copilot planning prototype.

| Component | Path | Status | Role |
| --- | --- | --- | --- |
| Local agent | `scripts/agent.mjs` | Built | One JSON tool call per turn, up to 12 turns, against Ollama on `127.0.0.1:11434` |
| TDD mode | `scripts/agent.mjs` | Built | Atomic tools bound to one source file: `read_test`, `read_source`, `replace_in_file`, `write_source`, `run_tests` |
| Sample runner | `dev/testing/run-sample.mjs` | Built | Adds one step test at a time; up to 3 fresh agent rounds per failing step |
| Specs | `dev/testing/specs/` | Built | guess-game (5 steps), hangman (9 micro-steps), tictactoe (React + Playwright, 4 steps) |
| Knowledge DB | `data/knowledge.db` | Built | Runs, attempts, tool events, verifications, success chains, credit; snapshots in `data/backups/` |
| Report | `dev/testing/report.mjs` | Built | Furthest step, rounds needed, failure kinds per model |
| Copilot controller | `src/` | Built, untested live | Copilot proposes 1–3 steps after `SEND`; Ollama drafts text after `RUN` |
| Tests | `dev/testing/unit/`, `acceptance/` | Built | Mocked controller tests, DB unit tests, acceptance tests against a fake loopback model |

Work is strictly top-down TDD: every feature starts with a failing acceptance test that runs the real runner and agent against a fake model and a temporary database. There is no CI; tests run locally on Hydra (GTX 1050, 4 GiB VRAM, 31 GiB RAM).

## Architecture and safety boundaries

The central rule is that the model never judges its own work: success is decided by running tests the model cannot change.

```
                 task                      tool call
 Sample runner ────────────► Local agent ◄───────────► Ollama on 127.0.0.1
 one step test at a time     one tool call per turn     qwen2.5-coder:3b or
 up to 3 rounds per step     path checks, approvals     qwen3.5:4b
       ▲                           │
       │ PASS / FAIL               │ replace_in_file
       │                           ▼
 Verify gate  ◄──── tested ─── Game source               Knowledge DB
 runs the step tests           one target file in src/   runs, attempts, events
 decides PASS or FAIL          all else is read-only     local SQLite, not pushed
       │                                                       ▲
       └──────────────── every attempt recorded ───────────────┘

 Tests, specs, data/ and the agent itself are write-protected from the model.
```

The runner hands the agent one failing step plus the current test output. The agent asks the model for one tool call at a time and applies it to the single target file; the runner then runs the tests and records the result.

| Boundary | How it is enforced |
| --- | --- |
| Local only | Fixed loopback host for Ollama; `data/` is git-ignored and never exported |
| No self-judging | A final answer counts only once `AGENT_VERIFY` exits 0; a final answer before any tool call is rejected |
| Tamper-proof records | The model cannot write `scripts/agent.mjs`, `.ollama/`, `data/`, `dev/testing/` or `AGENT_READONLY` paths |
| Narrow commands | Commands are allow-listed by exact string; approvals for writes and commands are kept separate |
| Bounded runs | 12 turns per run, 120 s command timeout (SIGTERM, then SIGKILL), output capped |

The project states plainly that these checks are not an OS sandbox: an approved command still runs with the user's permissions.

## Measured results

The 4B model works with this setup and the 3B model mostly does not: 10 of 15 steps against 1 of 15, across the same three games.

Steps passed per run (source: `data/knowledge.db`, runs 5–10, 2026-11-06 to 2026-11-07, TDD mode, temperature 0.2, up to 3 rounds per step):

| Game | qwen2.5-coder:3b | qwen3.5:4b |
| --- | --- | --- |
| guess-game | 1 of 5 (run 5) | **5 of 5** (run 8) |
| hangman | 0 of 6 (run 6) | 1 of 6 (run 9) |
| tictactoe | 0 of 4 (run 7) | **4 of 4** (run 10) |
| **Total** | **1 of 15** | **10 of 15** |

| Metric | qwen2.5-coder:3b | qwen3.5:4b |
| --- | --- | --- |
| Agent attempts that passed | 1 of 11 (9 %) | 8 of 12 (67 %) |
| Tool calls that failed | 33.9 % | 4.8 % |
| Time per model call | 14.7 s | 114.6 s |
| Time per attempt | 3.4 min | 11.0 min |

- **Speed is the 4B model's cost.** It runs about 68 % on GPU and 32 % on CPU on Hydra's 4 GiB card, so each call takes nearly 8 times longer than with the 3B model.
- **The 3B model's main failure is copying text.** 28 of its failed calls were `replace-no-match`: it could not quote existing code exactly. Other failures: `step-limit` 8, `bad-json` 3. The 4B model had 3 failed calls in total.
- **The usual successful pattern is short.** 7 of 11 recorded success chains were `replace_in_file → run_tests → final`.
- **Splitting a stuck step helped only partly (run 11).** Hangman was split into 9 micro-steps; the 4B model passed 2. Leaf `02a` passed, but every fix for `02b` broke `02a` again over 3 rounds.

| Hypothesis | Status |
| --- | --- |
| H1: Atomic tools, a starter file and low temperature raise success | Confirmed for 4B; 3B barely improved |
| H2: Splitting a stuck step into micro-steps unblocks it | Partly: blocked by regressions between sibling steps |
| H3: Automating the fixed loop parts cuts turns by ≥ 40 % | Planned |
| H4: Reusing verified programs removes the LLM from repeat work | Planned |
| H6: `think: false` cuts the 4B model's cost per call | Planned |

## Designed but not built

The design aims to make the LLM the rare learning path and stored, verified programs the normal execution path. It is fully written up in `dev/architecture/`, but none of it is built beyond hand-made micro-steps.

| Design | Core idea | Key rules |
| --- | --- | --- |
| Task tree (`task-tree.md`) | Split a task only when a small model fails it within K rounds; each node has its own test | Each child test must fail on the current code and be narrower than the parent; the parent test is always run again; `MAX_DEPTH` and a budget stop endless splitting |
| Program neurons (`program-neurons.md`) | A neuron = program + contract (the tests it passes) + record; identified by (test hash, program hash) | REQUEST looks up neurons per contract; EXECUTE runs programs only when every link is covered; LEARN runs the LLM for uncovered contracts only |
| Credit and promotion (`credit-and-promotion.md`) | Small reward per verified step, large reward for the whole chain, split by importance | Importance = difficulty × scarcity × learning cost; blame goes to the first failing link, or to the decomposer when all links pass but the root test fails |

Reputation decays by 0.95 per chain run and drives four levels: candidate, verified, trusted, preferred. Anti-gaming rules: only the verifier pays, repeats within 24 h earn less, a changed test resets reputation, and 10 % of requests explore a non-preferred neuron.

Planned build order: automate the fixed loop parts first (run tests after each edit, undo regressions, finish on all-pass), then the `neurons` table and reuse, then rewards, and automatic decomposition last. Training a decomposer model needs several hundred verified decompositions and a newer GPU than Hydra's GTX 1050.

## Relevance to GS-EBS-Brain

The project fills several gaps in GS-EBS-Brain's Learning Mode design with concrete, mostly adoptable rules. Its schema already uses EBS terms (tasks, steps, attempts, verifications, chains, credit), so the data can move without renaming.

| GS-EBS-Brain today | What this project offers |
| --- | --- |
| “All participants credited/penalized (C18, C28)”, no formula | Two-level rewards, blame rules, decaying reputation, four levels, anti-gaming rules |
| Neuron tracked by a generation counter | Identity by (test hash, program hash); a changed test invalidates old results |
| “Decompose” has no check | `valid()`: each child has a failing test, is narrower than the parent, and the parent test runs again |
| “Verify: harness-test the tool (C17)” | Measured reason to make the verifier independent and the tests write-protected |
| Child replaces parent if fitness ≥ parent | Run 11 shows a child must re-pass all earlier tests, not just the new one |
| Code-assistant plan: SFT on verified examples, then DPO on pass/fail pairs | The knowledge DB already records pass/fail per attempt, the raw material for both |
| Student model 1.5B–4B | Evidence that 3B cannot reliably follow a tool protocol; 4B can |

The learn-versus-execute ratio (about 3 × 10⁸) supports EBS's “catalogue the tool once verified” step with a hard number.

### Conflicts to settle

- **Who verifies.** EBS assigns roles, including verifier, by peer vote. This project requires a deterministic verifier that is never the author, added after the 3B model kept claiming success. Keep the verifier out of voted roles.
- **Sandboxing.** Path checks and approvals are not isolation. Running stored programs as neurons needs the sandbox EBS plans (isolated workers or Docker).
- **Fixed versus egalitarian roles.** This project fixes the decomposer (strongest model), executor (small model) and verifier (runner). EBS can start with fixed roles and add voting later.

## Gaps, risks and next steps

The biggest gap is evidence: 8 real-model runs on 3 games, so every baseline above could move a lot with more data.

**Gaps and risks**

- Most hypotheses (H3–H7) and metrics M9–M12 are designed but have no data yet.
- The Copilot controller's live authentication, cloud planning and live Ollama inference are untested; only mocks, the build and `--help` are verified.
- Only the guess-game starter has an acceptance test; the hangman and tictactoe starters do not.
- Hydra limits the 4B model to about 115 s per call, which makes larger experiments slow.
- `WHAT_IS_THIS_GOOD_FOR.md` still says a real-model TDD run is “still to come”, but runs 5–11 were exactly that.
- GS-EBS-Brain does not reference this project, so the alignment only goes one way.

**Recommended next steps**

1. Build level-2 automation (auto-run tests, auto-undo regressions, auto-finish) and rerun hangman to test H2 and H3.
2. Run H6 (`think: false`) to see whether the 4B model can get close to 3B speed.
3. Add more specs or variations, so baselines rest on more than 3 games.
4. In GS-EBS-Brain, add a Learning-system prototype section to `architecture/core/ARCHITECTURE.md` that links `measurable-architecture.md` and adopts the credit formulas, test-hash identity and `valid()` check.
5. Update `WHAT_IS_THIS_GOOD_FOR.md` to match the current status.

Sources: `CLAUDE.md`, `README.md`, `WHAT_IS_THIS_GOOD_FOR.md` and `dev/architecture/*.md` in GSHybridLLM-controller; a read-only copy of `data/knowledge.db`; `architecture/core/ARCHITECTURE.md` and `docs/CODE_ASSISTANT_PLAN.md` in GS-EBS-Brain.
