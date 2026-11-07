# Program neurons: programs instead of LLM calls 📐

An LLM is needed **once, to create** a program. After that, the verified program runs on its
own. The LLM becomes the slow, rare **learning path**; programs are the fast, normal
**execution path**. This is GS-EBS-Brain's "synthesize and compile a new tool, then reuse it"
([ebs-brain-alignment.md](./ebs-brain-alignment.md)).

## Why: measured scale

| | Value | Source |
| --- | --- | --- |
| LLM time to create guess-game (`qwen3.5:4b`, TDD mode) | 581 s (≈10 min) | knowledge DB, run 8 |
| Average cost of one model turn | 14.7 s (3B), 114.6 s (4B) | knowledge DB, runs 5–10 |
| Runtime of the resulting `play()` | ≈2 µs per call | measured on Hydra, 10 000 calls |

Creating costs about 10⁸ times more than executing. Every avoided LLM call matters.

## What a program neuron is

```
neuron = program      compiled/executable code (e.g. src/game.mjs at a given hash)
       + contract     the tests it is proven to pass (their hashes)
       + record       author (model or neuron), credit, reputation, level
```

A neuron is **identified by** `(contract_hash, program_hash)`. Same contract, different
program = competing neurons for the same job. A changed test = a new contract.

A contract also states the neuron's **interface**: what it takes as input and what it produces
(for the games: function signature and the shape of the returned lines or UI). Interfaces are
what lets chains form themselves.

## Self-forming chains

Chains are not wired by hand. They form by **matching interfaces**: a neuron whose output
fits the next contract's input can follow it. Two sources produce the chain's skeleton:

1. **Decomposition** (task tree): the decomposer names the contracts and their order.
2. **Matching** (REQUEST): for each contract, neurons whose interface and contract fit are
   looked up; when several fit, reputation and exploration decide
   ([credit-and-promotion.md](./credit-and-promotion.md)).

A chain only goes to EXECUTE when **every** link is covered (EBS-Brain: "does a chain of neurons
exist that can execute all steps?"). An uncovered link triggers learning for that one contract,
not for the whole task.

## Three levels where programs replace the LLM

| Level | Runs as a program | Gain | Status |
| --- | --- | --- | --- |
| 1. **The result** | A verified program is stored with its contract. A later request with the same contract executes it directly, with no LLM | Minutes → microseconds | 📐 |
| 2. **The fixed parts of the loop** | Steps that need no judgement are done by code: run the tests after every edit, undo edits that break earlier tests, show expected vs actual, finish automatically when all tests pass | Fewer LLM turns: the typical success chain `replace_in_file→run_tests→final` has 2 automatable turns of 3 | 📐 |
| 3. **Programs that make programs** | For recurring task families, the LLM writes a parameterized program or template once | One LLM call serves many tasks | 📐 |

## Lifecycles

```
REQUEST(task):                                  all lookup, no LLM
    for each contract in the task's chain:
        candidates = neurons with this contract, level ≥ verified
        none? → mark contract "needs learning"
    all covered → EXECUTE
    some uncovered → LEARN those contracts, then REQUEST again

EXECUTE(chain):                                 programs only
    run each neuron's program in order, in isolation
    root (acceptance) test decides the chain result
    → rewards and blame (credit-and-promotion.md)

LEARN(contract):                                the slow path
    executor LLM in TDD mode (atomic tools) until the contract's tests pass
    → new neuron at level "candidate"
    split into smaller contracts if it keeps failing (task-tree.md)
```

## Conditions

- **Verified before stored**, by the independent verifier (the gate), never by the author.
- **Step success is not chain success.** A neuron that passes its own contract can still break
  the chain; that is what chain rewards and blame are for
  ([credit-and-promotion.md](./credit-and-promotion.md)).
- **Invalidated on change:** a changed test changes the contract hash; the old neuron must be
  re-verified against the new contract before it counts again.
- **Isolated execution:** stored programs are executable code. Here they stay as confined as
  the agent (project root, no network by design of the games); EBS-Brain plans sandboxes.
- **Replaceable:** a failing neuron is recorded at its failure point; a better one for the same
  contract replaces it (EBS-Brain: child replaces parent when it performs at least as well).

## Prototype plan in this project

1. **Level 2 first** (runner/agent): auto-run tests after each edit and auto-undo regressions
   ✅ (regression guard, [local-agent.md](./local-agent.md)); show expected vs actual and
   auto-finish on all-pass 📐. Measure: turns per passing attempt, minutes per step (M5, M6 in
   [measurable-architecture.md](./measurable-architecture.md)).
2. **Level 1:** `neurons` table with stored program source per contract; the runner reuses a
   neuron whose contract matches before calling the LLM. Measure: reuse rate, time saved (M9, M10).
3. **Level 3:** only once recurring task families exist.

Each built test-first (acceptance test with the fake model first).
