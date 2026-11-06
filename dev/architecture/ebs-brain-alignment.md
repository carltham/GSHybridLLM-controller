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
| Tool must pass the test harness before use | Verify gate (`AGENT_VERIFY`) | ✅ |
| No neuron judges its own work | Tests, configs and gate are write-protected | ✅ |
| Persists what works, gets credit | `chains`, `credit` tables in the knowledge DB | ✅ |
| Others discover and reuse the capability | Success chains as examples for later runs | 📐 |
| REQUEST → EXECUTE: confirm a chain exists before dispatch | Planner checks every step has a test before execution | 📐 |

## What carries over

- **Schema:** [knowledge-db.md](./knowledge-db.md) uses EBS terms (tasks, steps, attempts,
  verifications, chains, credit) so the data and design can move without renaming.
- **Failure taxonomy:** the `kind` values are observed failure modes of real small models,
  useful as EBS verification categories.
- **Measured limits:** which model sizes can follow a tool protocol at all on modest hardware.

## Open questions for EBS-Brain

- How credit is assigned when several rounds (or models) contribute to one passing step.
- Whether chains are reused as prompts, as fine-tuning data, or both.
- How a decomposition (planner output) is itself verified before execution.
