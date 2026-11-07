# Decisions

Short records of decisions taken, newest last. Each: decision, reason, consequence.

1. **Local agent without Copilot.** Ollama is a local tool for whichever cloud AI is in use.
   → `scripts/agent.mjs` has no cloud dependency.
2. **Approvals are exact and per kind.** Commands are allow-listed by exact string; answer
   files keep write and run answers apart, missing answer = no. → A write approval can never
   approve a command; automation never widens permissions.
3. **No CI; tests run locally.** → `npm test` and the sample runner are run on Hydra.
4. **All testing under `dev/testing/`; output in `dist/`.** Tests are tracked; generated games
   are git-ignored output in `dist/games/<game>/` (not under any "testing" path).
5. **`src/cli` + `src/core` layout** for the controller, chosen over a flat `src/`.
6. **Top-down TDD.** Outer acceptance behaviour first, inner units later
   (e.g. `specs/guess-game/later/`).
7. **Freestanding games.** Every game has its own folder, `package.json`, tests and
   dependencies. This project is only the creator.
8. **The model never judges its own work.** Verify gate before a final answer is accepted;
   tests, configs and gate are write-protected. Reason: the 3B model repeatedly claimed
   success without running tests.
9. **Playwright for UI games, pinned to 1.63.0.** Matches the Chromium already cached on Hydra
   (1.65 would need ~280 MB of new browsers). Vite runs in-process so killed runs leave no
   server behind.
10. **Small steps × batched rounds.** Ordered step tests, each with up to N fresh agent rounds.
    Reason: small models degrade with long conversations and large tasks.
11. **Knowledge DB stays in this project** (`data/knowledge.db`), is never exported to
    GitHub (`data/` git-ignored) and is kept savable by local `VACUUM INTO` snapshots in
    `data/backups/`. Schema uses GS-EBS-Brain vocabulary.
12. **Model trial: `qwen3.5:4b`** after `qwen2.5-coder:3b` stalled at step 1–2. Newer
    families that fit 4 GiB VRAM were checked; 17 GB+ coding models do not fit Hydra.
13. **Recursive task tree.** Tasks are split only when an executor fails them; every node has
    its own test and the parent test always decides. Decomposer, executor and verifier are
    separate roles; escalation to a stronger model is never automatic to the cloud. See
    [task-tree.md](./task-tree.md).
14. **Decomposer training comes last.** First the knowledge DB and few-shot examples from it;
    fine-tuning a small model only with several hundred verified decompositions, off-Hydra
    (GTX 1050 too small), and only with the user's approval for any data leaving the machine.
15. **Top-down TDD for the tooling too.** Every feature starts with a failing outer acceptance
    test (runner + agent + fake loopback model + temporary DB), then the implementation, then
    inner unit tests. The knowledge DB was first built test-after; it was set aside, its
    acceptance tests were written and shown red, and only then restored and made green.
16. **TDD mode with atomic tools is the runner's only mode.** The model edits one named source
    file, starting from a starter with the right shape, and runs only the gate command. The task
    carries the current source and step test; temperature 0.2. Acceptance tests run serially
    because they share `dist/games/guess-game/`.
17. **Program neurons.** The LLM creates a program once; verified programs are stored per
    contract and executed without the LLM (learn once, execute fast; measured ratio ≈ 3 × 10⁸).
    See [program-neurons.md](./program-neurons.md).
18. **Two-level rewards.** Step success earns a small reward; only full chain success (root test)
    earns the large chain reward, split by importance (difficulty × scarcity × cost). Failing
    chains blame the first failing link, or the decomposer when all links pass but the root fails.
    See [credit-and-promotion.md](./credit-and-promotion.md).
19. **Measurable contract with GS-EBS-Brain.** Every claim has a metric with formula, source and
    baseline; EBS-Brain reads all files here locally, the knowledge DB read-only. "Chain" means a chain of
    tasks; the per-attempt tool sequence table will be renamed `tool_sequences`. See
    [measurable-architecture.md](./measurable-architecture.md).
