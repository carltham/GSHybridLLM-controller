# Alignment with GS-EBS-Brain

GS-EBS-Brain (`/mnt/DATA/Projects/0.present-projects/Active/GS-EBS-Brain`) describes neurons
that learn new skills by decomposing problems, synthesizing tools, verifying them against a
test harness and persisting what works. This project is working out the same loop at a small,
measurable scale with real local models. It stays a separate project; nothing here depends on
EBS-Brain code.

## Concept map

| EBS-Brain learning system | Here | Status |
| --- | --- | --- |
| Neuron enters learning mode for a task it cannot do | Agent run on a spec step that fails | ✅ |
| Decomposes the problem into atomic steps | `steps/` tests; 📐 recursive task tree ([task-tree.md](./task-tree.md)) | ✅ / 📐 |
| Synthesizes and compiles a new tool | Agent writes `src/` of a freestanding game | ✅ |
| The tool is executed instead of re-learned | Program neurons: stored verified programs, run without the LLM ([program-neurons.md](./program-neurons.md)) | 📐 |
| Tool must pass the test harness before use | Verify gate (`AGENT_VERIFY`) | ✅ |
| No neuron judges its own work | Tests, configs and gate are write-protected | ✅ |
| Persists what works, gets credit | `credit` per step and run ✅; step and chain rewards, blame, reputation, promotion ([credit-and-promotion.md](./credit-and-promotion.md)) 📐 | ✅ / 📐 |
| Others discover and reuse the capability | Success chains as examples for later runs | 📐 |
| REQUEST → EXECUTE: confirm a chain exists before dispatch | Self-forming chains: contracts matched by interface; EXECUTE only when every link is covered ([program-neurons.md](./program-neurons.md)) | 📐 |

For GS-EBS-Brain to read first: [measurable-architecture.md](./measurable-architecture.md)
(vocabulary, invariants, metrics with formulas and baselines, hypotheses, SQL).

## What carries over

- **Schema:** [knowledge-db.md](./knowledge-db.md) uses EBS terms (tasks, steps, attempts,
  verifications, chains, credit) so the data and design can move without renaming.
- **Failure taxonomy:** the `kind` values are observed failure modes of real small models,
  useful as EBS verification categories.
- **Measured limits:** which model sizes can follow a tool protocol at all on modest hardware.

## Open questions for EBS-Brain

- How credit is assigned when several rounds (or models) contribute to one passing step
  (a first answer: [credit-and-promotion.md](./credit-and-promotion.md)).
- Whether chains are reused as prompts, as fine-tuning data, or both.
- How a decomposition (planner output) is itself verified before execution.
