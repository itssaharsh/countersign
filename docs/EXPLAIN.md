# EXPLAIN.md — Saharsh's briefing (read before judging / demo day)

Rule 13 says you must be able to explain the agent, the architecture, and every technical
decision. This file is that briefing. Each section is: what we built → why → the question
a judge might ask → your answer.

## 1. The thesis in one breath
Approval gates show the command ("DELETE …? Allow/Deny") but not the consequence. A human
cannot weigh what they cannot see, so the gate degrades into a consent form. The consequence
was always computable: run the statement in a shadow transaction, measure what dies through
the real foreign keys, generate the undo, prove the undo works, and only then let an Approve
button exist. "We only delete what we can prove we can restore."

## 2. Architecture decisions (and the "why" a judge will probe)

### Custom MCP server (server/) instead of using only the shipped Supabase connector
- A shadow simulation must hold BEGIN → …many statements… → ROLLBACK on ONE connection.
  Per-call MCP tools cannot span a transaction across calls.
- The DB credential lives in the server process env — never in model context, never in
  the sandbox. (TrueForge's own philosophy: secrets stay in the harness layer.)
- Tool annotations are honest: measurement tools readOnlyHint, commit_change/fire_undo
  destructiveHint — so TrueForge's default @write/@destructive gate matches reality.

### The gate is server-side, the UI is a window
commit_change refuses unless (a) verified undo token, (b) recorded deterministic policy
PASS, (c) fingerprint still true AT COMMIT TIME (it re-measures). The console's
BLOCKED/ARMED/STALE button mirrors these preconditions but cannot override them — we
demo this by calling the tool directly and being refused.

### Scoped commit (the TOCTOU kill)
The human approves a fingerprint: count + sha256 of the sorted primary keys measured at
simulation time. commit_change deletes BY THAT PK LIST — it never re-runs the predicate.
Rows that started matching after measurement are REPORTED as drift (approval voided),
never silently destroyed. Judge question: "isn't re-measuring at commit racy too?" Answer:
the delete itself is scoped to the approved PKs inside one transaction, so the worst case
is refusing too often — never deleting unapproved rows.

### Undo verification is against COMMITTED state (not a tautology)
Replaying an undo inside the still-open transaction that deleted the rows would succeed
by construction. We instead apply the change on the SHADOW DB and COMMIT it, then run
the undo against that committed world and assert the exact PK set returns. Real test,
real failure mode; on success the shadow is self-restored.

### Deterministic policy engine, dual-path
The verdict comes from code (server/src/policy.mjs, and its Python twin in the skill for
the sandbox path) over measured JSON. Same input → same verdict on both paths (tested).
"The model proposes; only code blesses." No LLM anywhere in the verdict path.

### run_investigation (composite tool)
One governed call = simulate + verify undo + policy. Two reasons: (1) it is a governed
pipeline — the steps cannot be reordered or skipped by the model; (2) it cuts model
round-trips from ~5 to ~2, which matters on free-tier rate limits. The granular tools
still exist and are listed for step-by-step operation.

### Honest copy rules
- "NOT RESTORED BY THE GENERATED ROLLBACK" — never "cannot be reconstructed" (we only
  proved OUR undo failed, not that recovery is impossible).
- The fingerprint's scope is printed (volatile columns excluded: updated_at, …).
- The policy verdict prints its scope: row deltas, protected tables, undo, RESTRICT
  edges — NOT grants/triggers/sequences.

### Key rotor (tools/key-rotor.mjs) and the lean real-model profile
A local pass-through in front of Groq's OpenAI-compatible API. Why it exists: free tiers
are per-key rate/quota limited (8k TPM on gpt-oss-120b), and Groq counts `max_tokens`
against TPM. The rotor fails over across up to three keys on 401/402/413/429, promotes
the healthy key, waits out a throttled minute before the next cycle, times out hung
upstreams, and strips the assistant `reasoning_content` echo TrueForge sends back in
history (Groq rejects it — a genuine TrueForge↔Groq incompatibility). Keys live only in
a gitignored `.env`; TrueForge sees a dummy key and a localhost base URL. The `--real`
agent profile is deliberately lean (one preloaded server, no sandbox/subagent guidance,
max_tokens 2048, low reasoning effort) so a full approval loop fits the budget; `--mock`
keeps the full-capability profile for choreography. Judge question: "isn't the mock
cheating?" Answer: mocksmith is a scripted *test driver* that exercises the real harness,
tools and gates; the recorded demo runs the real model, and the README says so.

### The visual system: the counterfoil
The console is the paperwork of authorised destruction: a munitions release form, a bank
counterfoil, because that is what a countersignature is. Hairline rules, one seal, and a
hard rule that at most one element on screen may be red, and it is either the destructive
row count or the countersign control, never both. The total hands the red over when the
control materialises.

Three faces carry the whole type system: Bricolage Grotesque for display, Inter Tight for
prose, and IBM Plex Mono for **anything that came out of the database**. You can tell at a
glance what is measured data and what is Countersign talking.

The blast radius is drawn as a sectional elevation rather than tabulated, because a
foreign-key cascade is a load path failing through dependent members and a section is the
drawing you make before cutting. Depth down the page is foreign-key depth, bar length is
row count, and the distinction the product turns on is carried by fill pattern rather than
a column header: solid means the rows are gone, hatching means they survive with a
reference nulled, an unfilled boundary is a RESTRICT edge that takes nothing. Patterns
rather than colours, so the drawing still reads if you cannot tell the hues apart.

Earlier drafts went through a cinematic three.js stage and a scrolling story page. Both
were cut: they were a second read of the measurement, not an answer to "what is it waiting
on from me". The stage survives only as an ambient field behind the console.

### Reopening a gate after a reload (console v5.1.1)
Seen live: TrueForge answered `422 user message cannot be sent while approvals or questions
are pending`. The page had been reloaded; it remembered the session and turn ids but not the
approval, while the server still held it. Decision: the harness is the source of truth, so
the console rebuilds from the harness. On reconnect, if the saved turn ended with
`requiredActions`, `listTurnEvents` (ascending, the harness's insertion order, sorted by id
as a guard against paging) is replayed through the same `consume` reducer the live stream
uses, so the transcript, the tool cards and the gate come back exactly as they were
streamed. Questions (`tool.response_required`) are held the same way and answered with
`user.tool_response`. `send()` refuses while anything is pending and says what to do
instead; if the harness still refuses, the error is caught, the turn is rehydrated, and if
that fails both errors are shown rather than a silent "reopening". Trade-off: rehydration
re-reads the whole turn (hundreds of events at most); it runs once per reload and only when
a gate is actually open.

### Start over (console v5.1.2)
Seen live: a tab that outlived a stack restart kept a session whose gate had expired, and
Send looked dead. Decision: give the operator one obvious exit. "Start over" in the HUD
removes only the saved session pointer (localStorage) and reloads the page. A full reload,
not in-place state surgery, because the harness client, the engine poll and the stage all
key off that pointer at mount; reloading is the one path that is guaranteed consistent.
The query string is kept: in judge mode it is the replay itself, so start over restarts the
fixture stream and never turns replay into live mode. Nothing server-side is touched; the
old turn stays answerable from any tab that still points at it. Freshness applies to the
commit gate only: fire_undo is gated by committed state, verification and its one-shot
token, so the console never marks an undo gate stale, and a STALE commit gate now says
what to do (deny, then send the order again).

## 3. TrueForge usage map (Double-O track answers)
- MCP tools: custom countersign server + shipped github (PR fetch, receipt comment)
  + supabase connector planned for independent post-commit verification.
- Approval protocol: require_approval_for_tools (API-only field) pins literal names
  [commit_change, fire_undo]; pause = tool.approval_required; resume = user.tool_approval
  with allow / deny+reason. The deny reason is fed back to the agent.
- Console: speaks the documented SDK protocol directly (createTurnStream, withMetadata,
  isEventDelta/mergeEventDelta, sourceEventId lookup for gated args). We do NOT wrap
  the model — the harness runs the loop; we are a client of its event stream.
- Skills: countersign-dossier (git-backed SKILL.md) — progressive disclosure, scripts
  run in the sandbox. Registered from this public repo.
- Catalog overlays: MCP_CATALOG_PATH / SKILL_CATALOG_PATH make countersign a first-class
  preset in TrueForge's own settings UI.
- Sandbox: local sandbox fallback (bwrap/socat/rg) — code execution for the policy path;
  dual-pathed so the product still works sandbox-off.
- Subagents/dynamic capabilities: enabled; investigation can fan out. Session
  persistence: the console reconnects to a running turn (subscribeToTurn) and, for a
  turn that ended paused on a gate or a question, rebuilds the transcript and the gate
  from listTurnEvents (asc) through the live reducer, so a reload never strands an
  approval the server still holds (see "Reopening a gate after a reload" above).

## 4. Engineering incidents (judges like scars)
- PGlite corruption: attaching a second process to a PGlite data dir corrupts it
  (no lock protection). Fix: single-owner rule + POST /admin/reseed through the owning
  process + guards in every standalone tool. Deterministic seed makes reset cheap.
- Cascade deletes were O(N×M) without FK indexes — added them (realistic anyway).
- trueforge-ui 0.2.x embed loops ("getSnapshot should be cached", @assistant-ui/tap)
  against server 0.1.4 across React 18/19 — minimal repro preserved; console pivoted
  to the raw SDK (arguably the stronger story). Upstream issue planned after verifying
  against their quickstart wiring.
- Gemini free tier: 5 req/min + small daily cap → composite tool + paced demo runs.

### The receipt, and why the undo is a control that does not act
WITNESSING is the only screen in the design permitted a typewriter effect, at ~18ms a line.
Everything else in §6's budget of five is a fade, a count-up or a scale; a receipt printing
is the one place where the animation *is* the metaphor rather than decoration on top of it.
It is instant under `prefers-reduced-motion` like the rest.
The receipt shows the keys the commit was scoped to and the root rows actually deleted as
two separately labelled facts, never merged, because they answer different questions: what
the operator authorised, and what the database did with that authorisation. In the recorded
run they are both 6,000, which is the point — a divergence is what drift looks like.
No GitHub PR link: `/state` carries no PR reference and nothing writes one, so there is
nothing honest to render there.
The undo control is deliberately undramatic and, more importantly, **it does not fire the
undo**. It sends an order. The agent then calls `fire_undo`, TrueForge raises a second
approval, and the gate bar re-arms with `HOLD TO RESTORE` — the same 1200ms hold, filled in
`--proof` rather than `--seal` because restoring rows is not destructive. Nothing about the
undo is a single click, and the console must not imply otherwise.
The undo is one shot. `/state` exposes `undo.fired`, and once it is set the chip reads
`UNDO FIRED · rows restored` and the control is withdrawn rather than left to fail — the
engine refuses a replay (`undo_already_fired`) because it would duplicate rows.
Judge question: "why not just undo it for me?" Answer: because an undo is a write to the
production database, and the whole claim of this project is that a write to production gets
countersigned. Exempting our own undo would be exempting the one action we control.
### Credentials: why the scan reassembles, and why redaction lives in the component
`undo_token` authorises a rollback against the live database. `publicView` hands it to the
model because `commit_change` requires it — the token is the nonce proving verification
happened — so the model holds it, and any surface that renders tool arguments will show it.
That is three problems, and they need three different answers.
**The artifacts.** A recorded stream carries the model's prose in fragments. When the model
wrote the token into its own summary it was spelled across 229 content deltas: present in
the rendered transcript, absent from every individual line. `grep -c '<token>' real-run.jsonl`
returned 0 on a fixture that leaked. `tools/scan-secrets.mjs` therefore rebuilds each stream
the way the console's reducer does and scans the reconstruction.
Getting that reconstruction right is the whole tool, and the first version was wrong in a way
its own test could not see, because the test had one tool call. Two concurrent calls whose
argument chunks share a bucket interleave into a string in which *neither* token appears
intact — the scan reports clean on a file that leaks twice over. Delta chunks often carry
only `index` and no `id`, so the bucket key is now (message id, id ?? index), and reasoning
and content are one narration in arrival order rather than two buckets, because a value can
begin in one and end in the other. Four adversarial fixtures cover it: a chunk boundary
mid-UUID with no id in the first chunk, interleaved streams from two concurrent calls, a
token spanning the reasoning/content boundary, and the original prose case.
**The screen.** Scrubbing artifacts protects the repo and does nothing for a live demo being
screen-recorded, so redaction lives in the transcript component and covers live runs, replays
and any capture of either.
**The surfaces we do not own.** TrueForge's turn view renders the raw arguments and its API
serves the real value; that cannot be fixed from here, so the operating instruction is to keep
it off camera. The real fix is binding the token to the simulation server-side so the model
never holds it, which is a post-submission change.

## 5. Numbers you should know cold
18,000 users seeded · 6,000 doomed (last_active < 2025) → 17,971 orders → 19,442
payments (CASCADE edges) → 43,413 rows die · 37 SET NULL edges keep their rows and lose
3,542 references (support_tickets 952 of them) · invoices RESTRICT, 0 in the blast path ·
41 tables measured · undo 125 statements · simulate ≈ 8-10s on PGlite.
Policy: 4 rules, of which 3 can fire — see the README on `restrict_edges_block`.
