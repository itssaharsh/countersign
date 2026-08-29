# DECISIONS

Short, durable notes on choices and hazards that are not obvious from the code and
would otherwise be rediscovered the hard way. One line each where possible.

## Tooling

- **Screenshot and browser scripts use `waitUntil: 'domcontentloaded'`, never `networkidle`**, because the console's `/api/v1/agents` request proxies to TrueForge and hangs forever when TrueForge is down — `networkidle` then never fires and every script times out at 45s looking like a console bug.

## Process

- **A worktree branched off a shell that is still in review will silently revert fixes merged after its brief.** A clean rebase preserves neither the fix nor the failing case — it just replays the agent's file wholesale over the corrected one, and the diff looks correct in isolation. Rebase onto merged `main`, then re-verify the specific findings **by name** against the integrated tree. Two of #20's findings came back this way and were caught only by checking for them explicitly.

## Fixtures

- **`real-run.jsonl` and the `state-*.json` snapshots are one artifact, not three.** The console pairs them by `simulation_id` (`simulationFor` resolves the approval's `args.simulation_id` against `/state`), so they must be recorded from a single seeding in a single session. Re-recording one alone either breaks the pairing or requires editing the id, and editing a recorded id to make evidence line up is exactly the thing this project refuses.
