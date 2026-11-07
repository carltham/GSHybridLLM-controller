# GSHybridLLM-controller — Architecture

GSHybridLLM-controller lets local Ollama models do supervised work on this machine, and
measures how well they do it. It is also where the "decompose → synthesize → verify →
persist" logic for **GS-EBS-Brain** is being worked out on a small scale (see
[ebs-brain-alignment.md](./ebs-brain-alignment.md)).

Status markers used in these documents: ✅ implemented · 🧪 implemented, not yet proven live ·
📐 planned (design only).

## Reading order

1. This file: components and how they fit together (5 min)
2. [local-agent.md](./local-agent.md): the Ollama agent loop, tools and safety rules
3. [tdd-runner.md](./tdd-runner.md): sample games built test-first, in steps and rounds
4. [knowledge-db.md](./knowledge-db.md): ✅ recording success chains and failure points
5. [task-tree.md](./task-tree.md): 📐 recursive decomposition into atomic tasks and chains
6. [program-neurons.md](./program-neurons.md): 📐 programs instead of LLM calls (learn once, execute fast)
7. [credit-and-promotion.md](./credit-and-promotion.md): 📐 step and chain rewards, blame, reputation, levels
8. [measurable-architecture.md](./measurable-architecture.md): **for GS-EBS-Brain**: vocabulary, invariants, metrics with baselines, hypotheses
9. [controller.md](./controller.md): the Copilot planning prototype (`src/`)
10. [decisions.md](./decisions.md): decisions so far, and why
11. [ebs-brain-alignment.md](./ebs-brain-alignment.md): how this maps to GS-EBS-Brain

## Components

```
                 ┌──────────────────────────── GSHybridLLM-controller ───────────────────────────┐
                 │                                                                               │
 you / cloud AI ─┼─► dev/testing/run-sample.mjs ──► scripts/agent.mjs ──► Ollama 127.0.0.1:11434 │
                 │        │  (steps, rounds,          │  (tools, approvals,     (local model)     │
                 │        │   verify gate)            │   path confinement)                       │
                 │        ▼                           ▼                                           │
                 │   dist/games/<game>/  ◄──── writes src/ only ───                               │
                 │   (freestanding game,                                                          │
                 │    own package.json)        ✅ data/knowledge.db ◄── runs, attempts, events     │
                 │                                                                               │
                 │   src/ Copilot controller (separate prototype: Copilot plans, Ollama drafts)   │
                 └───────────────────────────────────────────────────────────────────────────────┘
```

| Component | Path | Status | Role |
| --- | --- | --- | --- |
| Local agent | `scripts/agent.mjs` | ✅ | One model, one JSON tool call per turn; approvals, allowlist, read-only paths, verify gate, events; TDD mode with atomic tools |
| Sample runner | `dev/testing/run-sample.mjs` | ✅ | Builds a freestanding game from specs: step by step, up to N agent rounds per step |
| Specs | `dev/testing/specs/<game>/` | ✅ | Scaffold with starter (`game/`), ordered step tests (`steps/`), `task.txt`, `verify.txt`, `target.txt` |
| Generated games | `dist/games/<game>/` | ✅ | Output; git-ignored, rebuilt on every run |
| Knowledge DB | `data/knowledge.db`, `dev/testing/knowledge-db.mjs`, `report.mjs` | ✅ | Runs, attempts, tool events, verifications, success chains, credit; snapshots |
| Task tree | (runner extension) | 📐 | Recursive decomposition; every node tested, leaves run as chains (first hand-made trial: hangman step 2) |
| Program neurons | (knowledge DB + runner) | 📐 | Verified programs stored per contract and executed without the LLM |
| Credit and promotion | (knowledge DB) | 📐 | Small step rewards, large chain rewards split by importance, blame, reputation, levels |
| Copilot controller | `src/` | 🧪 | Copilot proposes 1–3 steps after `SEND`; Ollama drafts text after `RUN` |
| Acceptance tests | `dev/testing/acceptance/` | ✅ | Outer layer: real runner and agent against a fake loopback model, temporary DB (`npm test`) |
| Unit tests | `dev/testing/unit/` | ✅ | Inner layer: mocked controller tests, knowledge-DB tests (`npm test`) |

## Boundaries that hold everywhere

- **Local stays local.** The agent talks only to `127.0.0.1` (port 11434, or `OLLAMA_PORT` for a
  fake model in tests). Local context and results are never sent to a cloud model.
- **The model never judges its own work.** Tests, configs and the gate command are outside
  its write access; success is decided by running the tests, not by the model's answer.
- **Generated games are freestanding.** Each has its own `package.json` and dependencies;
  this project is only the creator and never takes on a game's dependencies.
- **Approvals are not a sandbox.** Path checks and approvals reduce risk; an approved
  command still runs with the user's permissions.

## Hardware context (Hydra)

31 GiB RAM, GTX 1050 with 4 GiB VRAM; models in `/mnt/STORAGE/ollama`. Installed:
`qwen2.5-coder:3b` (fully on GPU) and `qwen3.5:4b` (about 68 % GPU / 32 % CPU,
~12 tokens/s). Larger coding models (`qwen3-coder:30b`, `qwen3.6`) do not fit.
