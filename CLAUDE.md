# Countersign — Project Constitution

**The approval layer for destructive database changes.** Built for The Agent Harness Hackathon
(WeMakeDevs × TrueFoundry × Qodo), Aug 24–30 2026. Deadline: **Aug 30, 8 PM London = 12:30 AM Aug 31 IST**.

## Thesis (never dilute this)
An approval gate that shows you the command instead of the consequence is not a safety control —
it's a consent form. The consequence was always computable: shadow-execute the destructive statement,
measure exactly what dies, prove the undo, and only then let an Approve button exist.

## Hard hackathon rules (violating any = disqualified)
1. Agent MUST run on TrueForge; judges must see the harness doing real work (MCP tool reached,
   code run in sandbox, pause before irreversible action).
2. **Every substantive change goes through a GitHub PR reviewed by Qodo before merge.**
   Direct pushes to main do not count. Fix every valid High finding or dismiss with a reason in-thread.
3. Repo public + runnable by judges. README has setup steps + `## Qodo Code Review Evidence` section.
4. NO keys, personal data, or login-protected info in repo or demo video. Keys live in `.env` (gitignored)
   or TrueForge Settings only.
5. AI-assistant use is disclosed in README (it is). Saharsh must be able to explain every decision —
   keep `docs/EXPLAIN.md` current as you build.
6. Git commits: authored by Saharsh's identity ONLY. **No Co-Authored-By trailers. Ever.**

## Architecture (see prompts/ for per-component specs)
```
GitHub PR (migration.sql)
   │  fetched by TrueForge agent via shipped `github` MCP
   ▼
TrueForge agent "countersign"  ← agent/spec.json, created via SDK (agent/create-agent.mjs)
   │  calls custom MCP server (streamable HTTP, localhost:8977)
   ▼
server/  countersign MCP server (TypeScript, @modelcontextprotocol/sdk)
   ├─ simulate_change   (read-only annotated) BEGIN → snapshot reachable rows → run DDL/DML
   │                     → measure per-table deltas via pg_constraint FK walk → ROLLBACK
   ├─ verify_undo       replay undo against COMMITTED state on shadow DB → assert PK set identical
   ├─ fingerprint_target count + hash of affected PK set (volatile columns normalized)
   ├─ measure_actual    post-commit re-measurement for the receipt
   └─ commit_change     THE GATED TOOL (require_approval_for_tools: ["commit_change"]).
                        Server-side refuses without: fresh fingerprint + verified-undo token + policy PASS.
                        Executes scoped to captured PK list (TOCTOU-safe).
   Databases: LIVE = Supabase project 1 (demo) / PGlite (dev). SHADOW = Supabase project 2 / PGlite.
   DB creds stay in server env — never in model context, never in sandbox.
   ▼
console/  React app built DIRECTLY on @truefoundry/trueforge-sdk (createTurnStream, delta merging,
   tool.approval_required -> user.tool_approval, subscribeToTurn reconnect). The trueforge-ui embed
   was dropped (it loops against server 0.1.4; see EXPLAIN.md). Three phases: INVESTIGATING ->
   DECIDING -> WITNESSING. Bright animated visual system: three.js point-cloud world that morphs
   with phase, glass cards over it, Instrument Serif kinetic type (see EXPLAIN.md "visual system").
skills/countersign-dossier/  SKILL.md + policy.yaml evaluator + dossier renderer (sandbox path;
   dual path: same engine callable inside server/ when sandbox is unavailable)
catalog/  branded MCP + skill catalog overlays (MCP_CATALOG_PATH / SKILL_CATALOG_PATH)
```

## Verified TrueForge cheatsheet (do NOT invent beyond this)
- Run: `SQLITE_PATH=... npx @truefoundry/trueforge@latest --port 8790` → http://localhost:8790
- Agent spec fields: model{name,params}, instructions, mcp_servers[{name, enable_tools, disable_tools,
  preload_tools, require_approval_for_tools, preload}], skills[{name}], config{sandbox{enabled,file_downloads},
  generative_ui, ask_user_questions, dynamic_sub_agents, context_management, iteration_limit},
  response_format, messages. `require_approval_for_tools` accepts @all/@write/@destructive/literal names. API-only.
- SDK: `new TrueForge({baseUrl, timeoutInSeconds})`; agents.create({name, manifest}); sessions.create({agent:{name}});
  sessions.createTurnStream(id,{input:[{type:'user.message',content}]}); stream.withMetadata() → {data,id}.
- Pause: `tool.approval_required` event; resume = NEW turn with
  {type:'user.tool_approval', threadId, toolCallId, approval:{status:'allow'|'deny', reason?}}.
  Questions: `tool.response_required` → {type:'user.tool_response', threadId, toolCallId, content}.
- Reconnect: persist session.id/turnId/lastSequenceNumber; getTurn → subscribeToTurn(id, turnId,
  {afterSequenceNumber}); finished → listTurnEvents. Merge deltas: isEventDelta/mergeEventDelta.
- Events carry threadId: "main" root, unique id = subagent (thread.created/thread.done), null = turn-level.
- UI SDK: TrueForgeUI props: layout (accepts custom component inside provider stack), agentConfig,
  theme{tokens} (40+ tokens → kebab-case CSS vars), brand, overrides (Partial<AtomSlots>).
  Hooks prefix is useTrueFoundry* (NOT useTrueForge*).
- MCP registration: Settings → Connectors → "Add MCP Server" (any remote URL; header auth or none).
  Catalog overlays: MCP_CATALOG_PATH / SKILL_CATALOG_PATH env vars (override REPLACES file — copy shipped + append).
- Sandbox: local fallback (bwrap+socat+rg on PATH) is ARMED; Daytona optional. Skills materialize at
  /opt/tfy/skills/{name}. WSL2 bootstrap blocked upstream (#482); policy engine is dual-pathed.

## Working agreements
- Branch per feature → PR → **wait for Qodo review** → address Highs → merge. PR titles: imperative,
  scoped. Descriptions: what/why/how-tested. Link issues.
- Honest copy everywhere: "NOT RESTORED BY THE GENERATED ROLLBACK", never "cannot be reconstructed".
- Every claim in README/demo must be reproducible by a judge. Replay mode (fixtures/) must work with zero keys.
- If a genuine TrueForge bug/docs gap surfaces: minimal repro → file upstream issue (gh, repo truefoundry/trueforge)
  with root-cause analysis. NEVER manufacture one.
- Definition of done per component lives in its prompts/NN-*.md file. Update prompts/LOOP.md backlog as you go.
