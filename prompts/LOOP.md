# Build loop — standing instruction

Each iteration: take the top unchecked item → branch → implement → test → PR → wait for Qodo →
address Highs → merge → check the box → update docs/EXPLAIN.md if a decision was made.
Surface blockers (keys, OAuth, accounts) to Saharsh immediately and continue with the next
non-blocked item. Never push to main directly after PR#1 (scaffold).

## Backlog (Day 1)
- [x] PR1 scaffold: this tree + package.json workspaces + CI-less basics (direct to main, allowed pre-Qodo)
- [x] Spike S1: TrueForge boots; countersign server registers via Add MCP Server; tools listed
- [x] Spike S2: literal-name require_approval_for_tools pauses on commit_change; scripted resume works
- [x] db/seed.ts: schema (~40 tables incl. users→orders→payments CASCADE chain) + seeded PGlite + SQL for Supabase
- [x] server: simulate_change end-to-end on PGlite with measured cascade
- [x] server: fingerprint_target + commit_change guard skeleton (refuse paths first)
- [x] agent: spec.json + create-agent.mjs + e2e.mjs happy path recording fixtures

## Backlog (Day 2)
- [x] server: verify_undo on shadow; undo_token; fire_undo
- [x] server: scoped commit + drift refusal + measure_actual receipt
- [x] skill: policy evaluator dual-path + dossier renderer
- [x] console: SDK-driven shell + theme + INVESTIGATING phase (cascade tree) — NOTE: TrueForgeUI embed loops (getSnapshot) vs server 0.1.4; pivoted to @truefoundry/trueforge-sdk directly; upstream issue repro kept in tools/
- [x] console: DECIDING gate state machine wired to real approval events
- [x] console: WITNESSING ledger + replay mode
- [x] NOON CHECK: one order end-to-end = qualification met?
- [x] catalog overlay + branding; github MCP receipt comment
- [ ] Night: pre-record happy-path video take

## Backlog (Day 3)
- [ ] MATCH control case + drift demo choreography (fixtures + live)
- [ ] Reconnect insert; subagent lanes if stable
- [ ] README (setup, Qodo evidence, AI disclosure, PITR answer, prior-art line) + docs/EXPLAIN.md final
- [ ] Record all takes → Descript edit → final video link
- [ ] Follow-up Qodo review on final code; submit by 10 PM IST
