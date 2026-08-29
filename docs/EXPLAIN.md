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

### The visual system (console v4): a cinematic stage
Why not a dashboard: the Best UI track is judged on the demo video and usability, and
the brief was explicit about the references (Lusion, Unseen Studio, Active Theory,
Bruno Simon): an experience, not a website. Those share one property: no chrome, no
cards. The 3D world is the page, typography is the interface, and the camera moves.
So the console is a full-screen three.js world (react-three-fiber, bloom, fog) with
type drawn over it. The world is a galaxy of rows that IS the database: idle it drifts
and you can drag to explore; while the agent investigates the doomed rows ignite and
gather into users, orders and payments with dashed light beams drawing the cascade and
floating 3D counts; when the gate arms the doomed set is held breathing inside a ring
of light whose arc is the freshness countdown; on commit the rows vortex away and the
field settles. A camera rig flies between scenes. The interface is a wordmark, a HUD
readout of the three proofs, a giant per-phase title, a thin transcript rail, one
command line with the agent's narration typed live, magnetic typographic Countersign
and Deny, and a glass receipt slab. Reduced-motion users get a still stage.
Judge question: "is the 3D just decoration?" Answer: it is state. Every scene is a
second read of what the engine measured, and the gate ring is the actual freshness
timer that the server enforces.

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
  persistence: the console can reconnect to a running turn (subscribeToTurn).

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

## 5. Numbers you should know cold
18,000 users seeded · 6,000 doomed (last_active < 2025) → 17,971 orders → 19,442
payments (CASCADE edges) · 3,000 support_tickets SET NULL (0 lost) · invoices RESTRICT ·
42 tables total · undo ≈ 87 statements · simulate ≈ 8-10s on PGlite · policy 4 rules.
