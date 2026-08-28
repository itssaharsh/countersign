<div align="center">

# ⬢ COUNTERSIGN

**The approval layer for destructive database changes.**

*An approval gate that shows you the command instead of the consequence is not a safety
control — it's a consent form. Countersign refuses to render an Approve button until the
agent has measured exactly what a change destroys and proven the rollback restores it.*

Built on [TrueForge](https://github.com/truefoundry/trueforge) for
[The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry × Qodo) · solo build · Aug 24–30, 2026

</div>

---

## The problem

Every agent harness ships human approval. The human sees a tool name and raw JSON:

> `commit_change {"table": "users", "where": "last_active < '2025-01-01'"}` — **Allow / Deny?**

Allow *what*, exactly? How many rows die? What cascades? Can it be undone? The safety
layer is a person guessing. That is not control — it is liability transfer.

## What Countersign does

A migration lands in a GitHub PR. The Countersign agent (running on TrueForge):

1. **Shadow-executes** the statement inside `BEGIN … ROLLBACK` on the live database and
   **measures** the true blast radius through every real foreign key — per-table row
   deltas, each edge labeled `CASCADE` / `SET NULL` / `RESTRICT`. Measured, not estimated.
2. **Generates the undo** from pre-image snapshots — then **proves it**: applies the
   change on a shadow database, **commits it**, replays the undo against that committed
   state, and asserts the exact primary-key set returns. A real test with a real failure mode.
3. **Evaluates policy deterministically** — a rules engine over measured JSON. No LLM
   anywhere in the verdict path. *The model proposes; only code blesses.*
4. Only then does TrueForge pause on the gated `commit_change` — and only then does the
   console's Approve control exist. Approval is a **fingerprint** (count + sha256 of the
   sorted PKs). The commit executes **scoped to that exact PK list** — rows that started
   matching after measurement are *reported as drift and void the approval*, never
   silently destroyed.
5. After the commit: a **receipt** (predicted vs measured, posted back to the PR) and an
   **armed, verified undo** — fire it and every approved row provably returns.

**We only delete what we can prove we can restore.**

## The console

| INVESTIGATING | DECIDING | WITNESSING |
|---|---|---|
| ![investigating](docs/screenshots/phase-investigating.png) | ![deciding](docs/screenshots/phase-deciding.png) | ![witnessing](docs/screenshots/phase-witnessing.png) |

The layout adapts to what you're doing: evidence board fills while the agent investigates
→ collapses to a single decision surface when TrueForge pauses (`BLOCKED → ARMED → STALE`
gate with a draining freshness meter) → becomes a live verification ledger after execution.
The UI is a *window* onto the gate, not the gate itself: `commit_change` refuses
server-side without a verified-undo token, a policy PASS, and a still-fresh fingerprint —
bypassing the button changes nothing.

## Run it

### Zero-key replay (fastest — judge mode)
```bash
git clone https://github.com/itssaharsh/countersign && cd countersign
npm install
npm run dev -w console      # → http://localhost:5199/?replay=/fixtures-state-witnessing.json
```

### Full live setup (~15 min)
```bash
npm install
node db/seed.mjs && node db/seed.mjs --dir ./pglite-data/shadow   # deterministic 42-table estate
node server/src/index.mjs                                          # countersign MCP server :8977
npx @truefoundry/trueforge@latest                                  # TrueForge :8790
```
Then in TrueForge (http://localhost:8790):
1. **Settings → Models** — add a provider key (Gemini free tier works; expect its 5 req/min limit).
2. **Settings → Connectors → Add MCP Server** — `http://127.0.0.1:8977/mcp`, name `countersign`
   (or launch TrueForge with `MCP_CATALOG_PATH=$PWD/catalog/mcp-catalog.yaml` for the one-click preset).
3. `node agent/create-agent.mjs` — creates the `countersign` agent (pins the API-only
   `require_approval_for_tools: ["commit_change","fire_undo"]`).
4. `npm run dev -w console` → http://localhost:5199 → transmit:
   *"Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'"*
5. Watch the evidence board fill, the gate arm, and TrueForge pause. The decision is yours.

End-to-end scripted proof (pause → approve → commit → undo → restore): `node agent/e2e.mjs --approve`
Engine test suite (10 tests, every demo claim): `node --test server/tests/`

## How it uses TrueForge

| Harness capability | Where it's load-bearing |
|---|---|
| Custom MCP server | `server/` — shadow tx must span many statements on one connection; DB creds stay server-side |
| Tool annotations + approval | read tools `readOnlyHint`; `commit_change`/`fire_undo` `destructiveHint` + pinned by literal name via the **API-only** `require_approval_for_tools` |
| Pause/resume protocol | console captures `tool.approval_required` (via `sourceEventId`), resumes with `user.tool_approval` (deny reasons feed back to the agent) |
| SDK-native UI | the console speaks `createTurnStream` / `withMetadata` / delta-merging directly — the harness runs the loop; we render its truth |
| Skills | `skills/countersign-dossier` — git-backed SKILL.md; deterministic policy evaluator + dossier renderer for the sandbox path (dual-pathed in-server when sandbox is off) |
| Shipped MCP catalog | `github` (PR-sourced migrations in, receipts out) |
| Catalog overlays | `catalog/` + `MCP_CATALOG_PATH`/`SKILL_CATALOG_PATH` → countersign appears as a first-class preset in TrueForge's own settings UI |
| Subagents / persistence | dynamic subagents enabled; sessions survive reconnects (`subscribeToTurn`) |

## Honest scope

- v1 measures single-table `DELETE … WHERE` (full cascade + verified row undo) and
  `ALTER TABLE … ADD COLUMN` (reversible control case with auto down-migration).
- Fingerprints cover row content with volatile columns excluded (printed on the gauge).
  They do **not** cover grants, triggers, sequences, or non-row side effects.
- A failed undo is reported as **"NOT RESTORED BY THE GENERATED ROLLBACK"** — we prove
  our rollback failed, not that recovery is impossible.
- Your database's PITR is a time machine that costs every write since the mistake.
  Countersign is a scalpel: row-scoped, reviewable, in the PR, armed in milliseconds.
- Prior art: Bytebase/PlanetScale gate database *pipelines*. Countersign is the approval
  surface for *any* destructive agent action — the database is the first domain, not the product.

## Qodo Code Review Evidence

Every substantive change entered through a pull request reviewed by Qodo.
*(This section links the representative merged PR + what Qodo surfaced and what we
changed/dismissed — populated as reviews complete.)*

## AI Assistance Disclosure

Built with heavy AI coding assistance (Claude Code, Anthropic). All architecture
decisions, code, and claims were reviewed and are understood by the participant —
see [docs/EXPLAIN.md](docs/EXPLAIN.md) for the decision-by-decision briefing.

## License

MIT © 2026 Saharsh Tibrewala
