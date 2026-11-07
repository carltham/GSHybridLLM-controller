# Credit, reward and promotion 📐

A neuron that passes its own test proves only that it works **alone**. A chain can still fail
because of one or a few links. Rewards therefore work on two levels: a small reward for a
single neuron's verified success, and a much bigger reward for the **whole chain**, paid only
on full chain success and split by each link's importance. A failing chain assigns blame to
the link (or decomposition) that broke it. Reputation built from rewards drives promotion and
demotion.

All parameters below are starting values to be tuned with measurements
([measurable-architecture.md](./measurable-architecture.md)).

## Terms

| Term | Meaning here | In this project |
| --- | --- | --- |
| Neuron | Program + contract + record ([program-neurons.md](./program-neurons.md)) | Verified source for one step, plus its author model |
| Contract | The tests a neuron must pass | One step test (hash) |
| Chain | Ordered contracts that together solve a task | All steps of a spec |
| Chain run | One execution of a chain | One `runs` row |
| Root test | Decides chain success | The full test suite after the last step |
| Verifier | Runs the tests; never the author | The runner (deterministic) |

Naming: the current `chains` table stores the **tool sequence inside one attempt**; it will be
renamed `tool_sequences`, and "chain" means a chain of tasks everywhere.

## 1. Step reward (small)

When a neuron's program passes its own contract, verified independently:

```
r_step(i) = B × d_i                     B = 1
d_i = 1 − p_i                           difficulty of contract i
p_i = (passes_i + 1) / (attempts_i + 2) smoothed success rate of contract i over all prior attempts
```

Easy contracts (solved by everyone in round 1) earn little; hard ones earn up to B.

## 2. Chain reward (big, split by importance)

Paid **only if the root test passes**:

```
R_chain = M × B × n                     M = 10, n = links in the chain
share_i = I_i / Σ_j I_j
I_i     = d_i × s_i × c_i               importance of link i
s_i     = 1 / (1 + alt_i)               scarcity: alt_i = other verified neurons for the same contract
c_i     = t_learn_i / mean(t_learn)     cost saved: LLM time it took to learn contract i
reward_i = R_chain × share_i
```

In a strict sequence every link is necessary, so necessity alone cannot rank links; difficulty,
scarcity and cost do.

**The decomposer shares in success too.** When a chain built from a decomposition passes, the
decomposer receives a share `D × R_chain` (start: `D = 0.1`) before the rest is split among the
links; when it was split *because* a parent failed and the parent now passes, `D` doubles.
Otherwise decomposing would only ever risk penalties.

## 3. Blame when the chain fails

| Situation | Effect |
| --- | --- |
| Link `k` fails (first failing verification) | Link `k`: penalty `−P × (1 − d_k)` with `P = 2B` (failing an easy contract is worse). Links before `k`: keep their step reward, no chain reward. Links after `k`: nothing (did not run) |
| All links pass, root test fails | The **decomposer** that produced this chain: penalty `−P_dec` (`P_dec = 2B × n`). Links are not penalized. This is task-tree's "children pass, parent fails" |
| Chain passes after a repair | Original version of the repaired link: penalty as above; the repairing neuron takes the link's share |

## 4. Reputation and levels

```
ρ ← λ × ρ + Σ rewards in this chain run        λ = 0.95 per chain run the neuron takes part in
```

| Level | Reached when | Effect |
| --- | --- | --- |
| candidate | Passed its own contract once (just learned) | May be used in chains |
| verified | Passed its own contract in ≥ 3 independent runs | Counted in `alt_i`; eligible for REQUEST |
| trusted | Part of ≥ 3 successful chains and ρ ≥ T_trust (start: 10) | Preferred over verified |
| preferred | Highest ρ among trusted neurons for its contract | Chosen first by REQUEST |

**Demotion:** ρ below the level's threshold, or 2 consecutive chain failures blamed on the
neuron → down one level. **Retirement:** blamed in 5 chain runs without a success in between,
or replaced by a neuron with higher ρ for 10 consecutive chain runs.

## 5. Protection against gaming

- **Only the verifier pays.** No self-reported success counts.
- **No farming:** at most one step reward per contract per chain run; the k-th repeat of the
  same contract within 24 h earns `r / (1 + k)`.
- **Exploration:** with probability ε = 0.1, REQUEST picks a non-preferred verified neuron, so
  an early winner cannot lock in.
- **Contract-bound:** a changed contract (new test hash) starts at zero reputation; old ρ does
  not carry over.

## Data (planned additions to the knowledge DB)

```
neurons         id, contract_hash, step_id, program_hash, program_source, author, created, level, reputation
rewards         id, neuron_id (NULL = decomposer), run_id, attempt_id, kind (step|chain|penalty|decomposer), amount, reason
tool_sequences  (rename of chains) id, attempt_id, signature
```

`credit` remains as the first-pass record per run and step until `rewards` supersedes it.

## What can already be computed today

From existing tables: `p_i` and `d_i` per step (attempts, passes), `t_learn_i` (attempt
durations), the first failing step of every run (blame point), and chain success (runs with
`result = 'PASS'`). `alt_i` and reputation need the `neurons` table.
