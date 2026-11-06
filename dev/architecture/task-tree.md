# Task tree and recursive decomposition 📐

A task is broken down into smaller and smaller tasks until a small local model can solve
each piece. The pieces form a tree; the leaves, run in order, form chains. Every node has
its own test, so every level is verified, not assumed. This is the prototype of the
GS-EBS-Brain learning loop ([ebs-brain-alignment.md](./ebs-brain-alignment.md)).

## Shape

```
Task: "terminal hangman game"                      root: acceptance test (outer layer)
├── Subtask: "show hidden word"                    inner node: integration test
│   ├── Atomic: "mask letters as _"                leaf: one test, one small change
│   └── Atomic: "join with spaces"
└── Subtask: "handle a guess"
    ├── Atomic: "reveal matching letters"
    ├── Atomic: "count a miss"
    └── Atomic: "detect win"
```

The tree is top-down TDD made explicit: the root is the acceptance test, inner nodes are
today's `steps/`, leaves are micro-steps.

## When a task is atomic

Not decided up front. **A task is atomic when a small model passes it within K rounds.**
Static hints that a task is a good leaf:

- exactly one test that fails before and passes after;
- one file or function changed, through narrow tools (`replace_in_file`, `run_tests`);
- input and output describable in one sentence.

## Recursion

```
solve(task, depth):
    if the knowledge DB holds a passing chain for an equivalent task → reuse it
    try the executor (small model, atomic tools) for up to K rounds
    if task's test passes            → record success chain, return PASS
    if task is indivisible or depth == MAX_DEPTH or budget spent
                                     → record failure point, return FAIL (or escalate)
    children = decompose(task)       # smaller tasks, each with its own test
    if not valid(children, task)     → record "bad decomposition", return FAIL
    for child in children (in order): # a chain
        if solve(child, depth + 1) == FAIL → return FAIL
    re-run task's own test           # the parent is verified again, never assumed
    return PASS, or record "children pass, parent fails" and return FAIL
```

The tree grows deep only where the model struggles and stays shallow where it does not.

## Safeguards

| Risk | Safeguard |
| --- | --- |
| Endless splitting | `MAX_DEPTH`, and a total budget of attempts and wall time per root task |
| Nothing left to split | A single-assertion test is the floor; if it still fails, escalate instead of splitting |
| Fake progress | A child must be strictly narrower than its parent (different, smaller test); children equal to the parent are rejected |
| Wrong children | Each child test must **fail on the current code** before work starts; the parent test always has the last word |
| Repeated work | Memoization via the knowledge DB: solved equivalent tasks are reused, not split again |
| Order dependencies | Children run as an ordered chain; the first failing child stops it and is the recorded failure point |
| Tampering | Tests at every level are write-protected from executors (as `dev/testing/` is today) |

`valid(children, task)` checks at least: every child has a test; every child test fails on
the current code; no child equals the parent; the number of children and the tree size stay
within limits.

## Roles

| Role | Does | Who |
| --- | --- | --- |
| Decomposer | Splits a task into ordered children, each with a test | Strongest available model: the cloud AI or the largest local model. The weakest link: writing correct smaller tests is harder than solving them |
| Executor | Solves one leaf with atomic tools | Small local model (e.g. `qwen3.5:4b`) |
| Verifier | Runs the tests; never the same party as the executor | The runner (deterministic) |

**Escalation must stay explicit.** This project forbids automatic escalation to the cloud.
Handing a task to a stronger model needs approval, or is limited to local models.

## What is recorded

In the knowledge DB ([knowledge-db.md](./knowledge-db.md)), extended with the tree:

```
tasks   + parent_id, depth, origin (hand | decomposer:<model>)
```

- **Success chains:** the path of passing tasks.
- **Where splitting helped:** parent failed, then passed after its children did.
- **Where splitting did not help:** children passed, parent still failed. The
  decomposition missed something; this is EBS-Brain's open question of how to verify a
  decomposition.
- **Depth needed per model:** e.g. depth 3 for a 4B model versus depth 1 for a larger model.
  A direct measure of model ability.

## Training a decomposer 📐

Goal: a small local model that breaks tasks down well. Training is possible, but only after
the knowledge DB has collected enough verified decompositions, and not on Hydra's GPU.

### Data (the main gap)

| Kind | Source in the knowledge DB | Use |
| --- | --- | --- |
| Positive | Parent failed → children passed → parent passed | Supervised fine-tuning examples |
| Negative | Children passed but parent failed, or `valid()` rejected the children | Paired with a positive split of the same task for preference training (DPO) |

A useful fine-tune needs roughly several hundred to a few thousand verified examples. Three
games are not enough; more specs (or variations of them) are needed.

### Hardware

- Fine-tuning a 1.5–4B model (LoRA/QLoRA) needs about 6–16 GB of GPU memory and a newer GPU.
  Hydra's GTX 1050 (4 GiB, Pascal) is not enough and is unsupported by common tools such as
  Unsloth; CPU training would take days per run.
- Realistic: a rented GPU for a few hours, or a machine with a newer GPU. The trained adapter
  returns to Hydra and runs in Ollama (converted to GGUF, loaded via a Modelfile `ADAPTER`).
- **User decision required:** a rented GPU means the training data leaves this machine
  (not to GitHub, but to a provider).

### Without training (first)

- **Few-shot from the DB:** put the most similar verified decompositions into the
  decomposer's prompt (EBS-Brain "discover and reuse").
- **Strict output format:** force a fixed JSON tree structure, so formatting cannot fail.

### Distillation

A stronger model (e.g. the cloud AI) decomposes, only verified results are kept, and a small
model is trained on them. Conditions: user approval for every cloud use (local results do not
go to the cloud by default), and the provider's terms must allow training on its outputs.

### Order

1. Knowledge DB records every decomposition with its outcome.
2. Few-shot examples from the DB: better decomposition, no training.
3. Collect verified decompositions until there are several hundred.
4. Fine-tune a 1.5–4B model off-Hydra; measure it with the same runner on held-out tasks it
   has never seen.

## Build plan

1. **Hand-made trees** for guess-game, hangman and tictactoe: today's steps as inner nodes,
   micro-steps as leaves. No automatic splitting. Proves the recursion, the verification at
   every level and the DB records.
2. **Automatic decomposition** by a decomposer model, guarded by `valid()` and the budget.
3. **Memoization** through the knowledge DB, so solved tasks are reused.

Prerequisites: atomic tools in the agent ([local-agent.md](./local-agent.md)) and the knowledge
DB ([knowledge-db.md](./knowledge-db.md)).
