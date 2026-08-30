# Submission draft (paste into the hackathon form)

**Project name:** Countersign

**Try it (no setup):** https://countersign-xi.vercel.app

Open it and drive it yourself. It replays a recorded run of the real agent, the same event
stream through the same code, stopping where the harness actually stopped, and you can hold
the countersign control. It says on the page that it is a replay and not connected to a
database, because a static host cannot hold one.

**Repository:** https://github.com/itssaharsh/countersign

Clone it and it runs against a database for real, either local files with no accounts needed
or your own managed Postgres. Setup is in the README, and docs/ADOPT.md covers pointing it at
your own estate.

**One-liner:** The approval layer for destructive database changes. The approve button does
not exist until the agent has measured exactly what dies and proven the rollback.

**Write-up (what it does + how it uses TrueForge):**

Every agent ships an approval gate that shows the human a tool name and raw JSON. That is
not a control — it's a consent form. Countersign inverts it: a TrueForge agent
shadow-executes the destructive change inside BEGIN…ROLLBACK on the live database,
measures the true blast radius through real foreign keys (per-table deltas, CASCADE /
SET NULL / RESTRICT edges), generates an undo from pre-image snapshots and PROVES it
against committed shadow state, and passes a deterministic policy engine — only then does
TrueForge pause on the gated commit. Approval is a fingerprint (root PK set + row content
+ per-cascade-child probes); the commit executes scoped to those exact keys inside the
same transaction as its freshness re-check, so drift is reported, never destroyed. After
execution: a receipt posted to the originating GitHub PR and an armed, verified undo —
fire it and every approved row provably returns.

TrueForge is the spine: a custom MCP server holds the transaction machinery and DB
credentials; tool annotations drive the default approval policy while the API-only
require_approval_for_tools pins the two irreversible tools by name; the console is
built directly on the SDK's documented protocol (createTurnStream, delta merging,
tool.approval_required -> user.tool_approval, subscribeToTurn reconnects) with a
phase-adaptive UI (INVESTIGATING -> DECIDING -> WITNESSING); a git-backed skill carries
the deterministic policy evaluator for the sandbox path; catalog overlays make
Countersign a first-class preset in TrueForge's own settings UI. During the build we
found and reported real upstream issues (sandbox bootstrap on WSL2 —
truefoundry/trueforge#482, reproduced with environment details and a root-cause
hypothesis).

Code review: every substantive change went through Qodo-reviewed PRs — 26 findings
(22 High), all fixed or dismissed with reasons in-thread, including a genuine High on our
core promise (cascade-child drift). Full trail in the README's Qodo Code Review Evidence
section and docs/QODO-LOG.md.

**Repo:** https://github.com/itssaharsh/countersign
**Demo video:** (link after Descript export)
**Built solo, with AI assistance (disclosed in README).**
