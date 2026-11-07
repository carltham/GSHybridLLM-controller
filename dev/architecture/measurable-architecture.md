# Measurable architecture (for GS-EBS-Brain)

This document is written for the GS-EBS-Brain project to read. It states what
GSHybridLLM-controller builds, in EBS-Brain terms, and how every claim is **measured**: each
metric has a definition, a formula, a data source and a current baseline. Design details are
in the linked documents; this one is the contract between the two projects.

Status markers: ✅ implemented and measured · 📐 designed, not built.

## 1. Purpose

Prototype EBS-Brain's learning loop with real local models on modest hardware:

```
decompose task → synthesize a program per step (LLM) → verify independently → store as neuron
→ execute chains of neurons without the LLM → reward chains, blame broken links → promote/demote
```

## 2. Vocabulary

| EBS-Brain | GSHybridLLM-controller | Where |
| --- | --- | --- |
| Neuron | Program + contract + record | [program-neurons.md](./program-neurons.md) 📐 |
| Learning mode | Agent in TDD mode on a failing contract | [local-agent.md](./local-agent.md) ✅ |
| Test harness | Verify gate (`AGENT_VERIFY`), run by the runner | [tdd-runner.md](./tdd-runner.md) ✅ |
| Decomposition | Ordered step tests; recursive task tree | [task-tree.md](./task-tree.md) ✅ / 📐 |
| Signal chain (REQUEST → EXECUTE) | Chain of contracts; lookup then execution | [program-neurons.md](./program-neurons.md) 📐 |
| Credit, peer judgement | Step and chain rewards, blame, reputation, levels | [credit-and-promotion.md](./credit-and-promotion.md) 📐 |
| Knowledge persistence | Knowledge DB (SQLite) | [knowledge-db.md](./knowledge-db.md) ✅ |

## 3. Entities and identity

| Entity | Identity | Table |
| --- | --- | --- |
| Task | name (+ parent for subtasks) | `tasks` ✅ |
| Contract | step test hash | `steps.test_hash` ✅ |
| Chain run | run id; model, mode, temperature | `runs` ✅ |
| Attempt | (run, step, round); round 0 = check before any LLM | `attempts` ✅ |
| Model turn | (attempt, seq): tool, outcome, failure kind, duration | `events` ✅ |
| Verification | command, exit code, passed/failed counts | `verifications` ✅ |
| Neuron | (contract hash, program hash) | `neurons` 📐 |
| Reward | (neuron, run, kind, amount) | `rewards` 📐 |

## 4. Invariants (each is checkable)

| ID | Invariant | How it is checked |
| --- | --- | --- |
| I1 | The author never judges its own work | Acceptance test: a model that only claims success fails, no credit ✅ |
| I2 | Tests and records cannot be changed by the model | Acceptance test: writes to tests refused, tests unchanged; `data/` write-protected ✅ |
| I3 | Local only: models on `127.0.0.1`, knowledge never exported | Code: fixed loopback host; `data/` git-ignored ✅ |
| I4 | Chain success is decided by the root test, never by summing step successes | Runner: final verification after the last step ✅; task-tree parent re-check 📐 |
| I5 | A changed contract invalidates earlier results | `steps` keyed by test hash ✅; neuron re-verification 📐 |

## 5. Metrics catalogue

Baselines: knowledge DB runs 5–10 (2026-11-07, TDD mode, temperature 0.2, 3 rounds per step,
games guess-game, hangman, tictactoe), Hydra (GTX 1050 4 GiB, 31 GiB RAM).
Run 11 is the hangman micro-step trial (H2) and is not part of these baselines.

| ID | Metric | Definition / formula | `qwen2.5-coder:3b` | `qwen3.5:4b` |
| --- | --- | --- | --- | --- |
| M1 | Chain success rate | runs with `result = 'PASS'` / runs | 0/3 | 2/3 |
| M2 | Step success rate | Σ `steps_passed` / Σ `steps_total` | 1/15 | 10/15 |
| M3 | Attempt success rate | LLM attempts (round ≥ 1) that passed / all | 1/11 (9 %) | 8/12 (67 %) |
| M4 | Turn error rate | turns with `outcome <> 'ok'` / turns | 33.9 % | 4.8 % |
| M5 | Turns per passing attempt | mean events per passing attempt | 3.0 | 3.6 |
| M6 | Cost per model turn | mean `events.duration_ms` | 14.7 s | 114.6 s |
| M7 | Learning time per step | mean attempt duration (round ≥ 1) | 3.4 min | 11.0 min |
| M8 | Learn-vs-execute ratio | time to create a program / its runtime per call | – | ≈ 581 s / 2 µs ≈ 3 × 10⁸ |
| M9 | Neuron reuse rate 📐 | requests served without LLM / requests | – | – |
| M10 | Time saved by reuse 📐 | Σ (t_learn of reused contract) | – | – |
| M11 | Blame precision 📐 | failing chains whose blamed link, once replaced, makes the chain pass / failing chains | – | – |
| M12 | Decomposition yield | parents that pass after their children pass / parents split | – | 0/1 (hangman step 2: parent not reached; run 11) |
| M13 | Contract difficulty `d_i` | `1 − (passes+1)/(attempts+2)` per contract | per step, see §7 | |

Most common failure kinds (from `events.kind`): 3B `nonzero-exit` 47, `replace-no-match` 28,
`step-limit` 9; 4B `nonzero-exit` 7, `step-limit` 2, `replace-ambiguous` 1. `nonzero-exit`
is a red test run, which is expected during learning; `replace-no-match` means the model could
not copy existing text exactly.

## 6. Hypotheses and experiments

| ID | Hypothesis | Measure | Result / status |
| --- | --- | --- | --- |
| H1 | Atomic tools + starter + context + low temperature raise success | M2, M3, M4 before/after TDD mode | ✅ Confirmed for 4B: guess-game from step 3 ❌ to 5/5, tictactoe from not run to 4/4; 3B barely improved |
| H2 | Splitting a stuck step into micro-steps unblocks it | M12; passes of hangman `02d` | 🧪 Partly: the isolated leaf `02a` passed (round 2), but `02b` failed 3 rounds because each fix broke `02a` again; `02d` not reached (run 11). Next: retry after auto-undo of regressions (H3) |
| H3 | Automating the fixed loop parts cuts turns per step by ≥ 40 % | M5, M7 before/after level-2 automation | 📐 |
| H4 | Reusing verified programs removes the LLM from repeat work | M9, M10 | 📐 |
| H5 | Chain-reward shares predict replacement value (high-share links matter most) | M11; ρ vs. chain success when the link is swapped | 📐 |
| H6 | Turning off the 4B model's thinking (`think: false`) cuts cost per turn a lot without losing much success | M6, M7 vs. M2, M3, same specs | 📐 (needs a recorded run setting, like `mode` and `temperature`) |
| H7 | Self-forming chains find a covering chain when one exists | share of tasks where REQUEST covers every link vs. a hand-checked answer | 📐 |

## 7. Reading the data

The knowledge DB lives in **this** project at `data/knowledge.db` (SQLite, schema version in
`PRAGMA user_version`, currently 2). It is never exported to GitHub. GS-EBS-Brain reads **all files of this project** locally,
including the knowledge DB (read-only, preferably from a snapshot in `data/backups/`); the
files stay here.

```sql
-- M1, M2: chain and step success per model (TDD mode)
SELECT model, COUNT(*) runs, SUM(result = 'PASS') chains_passed,
       SUM(steps_passed) steps_passed, SUM(steps_total) steps_total
FROM runs WHERE mode = 'tdd' GROUP BY model;

-- M3, M7: attempt success and learning time
SELECT r.model, COUNT(*) attempts, SUM(a.result = 'PASS') passed, AVG(a.duration_ms) / 60000.0 avg_min
FROM attempts a JOIN runs r ON r.id = a.run_id WHERE r.mode = 'tdd' AND a.round >= 1 GROUP BY r.model;

-- M4, M6: turn error rate and cost per turn
SELECT r.model, AVG(e.outcome <> 'ok') error_rate, AVG(e.duration_ms) / 1000.0 avg_s
FROM events e JOIN attempts a ON a.id = e.attempt_id JOIN runs r ON r.id = a.run_id
WHERE r.mode = 'tdd' GROUP BY r.model;

-- M13: contract difficulty
SELECT s.test_hash contract, s.name, 1 - (SUM(a.result = 'PASS') + 1.0) / (COUNT(*) + 2) difficulty
FROM attempts a JOIN steps s ON s.id = a.step_id WHERE a.round >= 1 GROUP BY s.id;

-- Blame point of each failed chain: its first step that never passed
SELECT r.id run, r.model, MIN(s.ord) first_failing_step
FROM runs r JOIN attempts a ON a.run_id = r.id JOIN steps s ON s.id = a.step_id
WHERE r.result = 'FAIL' AND NOT EXISTS (SELECT 1 FROM attempts b WHERE b.run_id = r.id AND b.step_id = s.id AND b.result = 'PASS')
GROUP BY r.id;
```

Runs with `mode IS NULL` (run 1) predate schema version 2; exclude them from comparisons.
Run ids 2–4 are missing on purpose: they were fake-model test runs and have been deleted.

## 8. Build order (what becomes measurable when)

1. ✅ Knowledge DB, TDD mode, step × round runner → M1–M8, M13
2. 🧪 Hand-made task tree (micro-steps) → M12
3. 📐 Program neurons level 2 (automated loop) → H3
4. 📐 `neurons` table and reuse (level 1) → M9, M10, H4
5. 📐 Rewards, blame, reputation, levels → M11, H5
6. 📐 Automatic decomposition; decomposer training last ([task-tree.md](./task-tree.md))
