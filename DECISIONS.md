# DECISIONS

Short, durable notes on choices and hazards that are not obvious from the code and
would otherwise be rediscovered the hard way. One line each where possible.

## Tooling

- **Assert capability, never response.** Everything in this repo that has fooled us failed by answering successfully while being useless: TrueForge returning 200 on `/api/v1/agents` with no model providers configured, so every agent creation 422'd; `networkidle` never firing because a proxied request to a dead service hangs open rather than failing, so browser scripts must wait on `domcontentloaded`; and our own assertions passing because they measured the absence of a *different* bug than the one they named. A health check that proves a service is listening proves nothing. Ask it to do the thing: can it name a model, does the ledger total equal the sum of `delta`, does the check still fail when the defect is deliberately reintroduced. Every check should have a mutation that breaks it.

## Process

- **A worktree branched off a shell that is still in review will silently revert fixes merged after its brief.** A clean rebase preserves neither the fix nor the failing case — it just replays the agent's file wholesale over the corrected one, and the diff looks correct in isolation. Rebase onto merged `main`, then re-verify the specific findings **by name** against the integrated tree. Two of #20's findings came back this way, and two more in later branches, all caught only by re-checking them by name — an instance of the rule above.

## Security

- **Credential scans must run against reconstructed content, not structured fields.** A recorded stream carries the model's prose in fragments, so a token the model writes into its own summary is spelled across hundreds of content deltas: it exists in the rendered transcript while appearing in no single line of the file. A field-level or line-level grep reports clean on a fixture that leaks — `grep -c '<token>' real-run.jsonl` returned **0** while the reassembled content contained it. `tools/scan-secrets.mjs` rebuilds each stream the way the console's reducer does and scans the reconstruction; it is proved against the pre-fix fixture, where the field scan finds nothing and the reassembling scan finds the token.
- **Redact at the point of display, not only in the artifacts.** The transcript renders tool arguments and results verbatim, and `commit_change` carries `undo_token` — a value that authorises a rollback against the live database. Scrubbing fixtures protects the repo and does nothing for a live demo being screen-recorded. Redaction lives in the component, which covers live runs, replays and any capture of either at once.

## Fixtures

- **`real-run.jsonl` and the `state-*.json` snapshots are one artifact, not three.** The console pairs them by `simulation_id` (`simulationFor` resolves the approval's `args.simulation_id` against `/state`), so they must be recorded from a single seeding in a single session. Re-recording one alone either breaks the pairing or requires editing the id, and editing a recorded id to make evidence line up is exactly the thing this project refuses.
