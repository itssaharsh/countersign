# Workstream: TrueForge agent (agent/)

- agent/spec.json — full manifest. model from Settings (gemini-3.6-flash default; switchable).
  mcp_servers: countersign (require_approval_for_tools:["commit_change","fire_undo"]), github, supabase.
  config: dynamic_sub_agents on, ask_user_questions on, sandbox per availability,
  iteration_limit 60. response_format left text (tool JSON is structured already).
- agent/create-agent.mjs — SDK script: creates/updates named agent "countersign".
- agent/instructions.md — system prompt: role, investigation lanes (blast/exposure/policy),
  never claim what a tool didn't measure, always simulate before proposing commit, use
  ask_user_question for ambiguous target predicates.
- agent/e2e.mjs — scripted end-to-end: open session → "Process migration PR #N" → stream events
  to fixtures/run-*.jsonl → detect tool.approval_required → resume with approval → assert receipt.
  This script is BOTH the test harness and the fixtures generator for console replay mode.

## Acceptance
e2e.mjs completes: pause observed, resume works, receipt lands, fixtures written.
