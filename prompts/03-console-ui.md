# Workstream: console (console/)

Vite + React + TS + Tailwind + shadcn. @truefoundry/trueforge-ui custom layout INSIDE TrueForgeUI
provider stack; agentConfig {mode:"SingleAgent", name:"countersign"}. Theme: tweakcn dark-tactical
base + custom tokens; fonts Special Elite / JetBrains Mono / Share Tech Mono; augmented-ui frames;
React Bits decrypt-text for headers; MagicUI number tickers.

## Three phases (drive layout from the event stream)
1. INVESTIGATING — cascade tree (custom, framer-motion) fills as simulate streams; evidence lanes
   (blast/exposure/policy) as HUD panels.
2. DECIDING — on tool.approval_required: collapse to single decision surface. Allow control is a
   three-state machine: BLOCKED (missing proofs, shows which) → ARMED (all proofs, freshness meter
   draining) → STALE (drift detected; diff streams in where the button was; primary action Re-measure).
   Approve/Deny via useTrueFoundryRespondToToolApproval. Deny requires a reason (fed back to agent).
3. WITNESSING — live verification ledger: rows-gone counter, receipt render, armed-undo panel.

## Replay mode
`?replay=fixtures/run-happy.jsonl` — feeds recorded events through the same reducers. Zero keys.

## Acceptance
Playwright screenshot loop clean at 1920x1080; phases transition on real e2e run; replay mode
works in a fresh clone with `npm i && npm run dev` only.
