# Qodo review log

Rule: fix every valid High finding or dismiss it in-thread with a reason. This log tracks
every finding across the review trail. (Severities as assigned by Qodo.)

## PR #1 — shadow-execution engine (12 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Child drift is silently destroyed | High | **FIXED** — fingerprint v2 records each CASCADE table's affected-PK hash + its exact probe query; `checkDrift` re-runs the probes; commit refuses on any child-set change. Test: "CHILD drift voids the approval". |
| 2 | Row updates evade fingerprinting | High | **FIXED** — root row *content* hash (volatile columns excluded) added to the fingerprint; edits void the approval. Test: "CONTENT drift voids the approval". |
| 3 | SET NULL changes persist | High | **FIXED** — simulation snapshots the references SET NULL edges will clear; the undo now restores them (CASE-batched UPDATEs). Test asserts nulled refs return. |
| 4 | Undo verification ignores descendants | High | **FIXED** — `verifyUndo` measures every snapshotted cascade table on the shadow after replay, reported per-descendant. |
| 5 | Reversible changes bypass gates | High | **FIXED** — reversible commits now require verified down-migration + policy PASS + matching token, same as destructive ones. |
| 6 | Reversible undo is never tested | High | **FIXED** — `verifyUndo` executes the up migration AND the down migration against committed shadow state before `verified` is set. |
| 7 | Drift check races deletion | High | **FIXED** — the drift check now runs *inside* the same transaction as the scoped delete. |
| 8 | Transactions can interleave | High | **FIXED** — per-handle transaction queue serializes all `withTransaction` work (PGlite and Postgres paths). |
| 9 | Restart disables verified undo | High | **FIXED** — simulations persist to the evidence dir and are restored on boot (undo SQL re-attached). |
| 10 | Multiple cascade paths lose rows | High | **DISMISSED (reason in-thread)** — per-table deltas already come from executed before/after counts, so diamond paths cannot miscount; a diamond-path undo gap would fail the committed-state undo verification, which blocks the commit. Fails safe; single-path estate in v1; scope noted in README. |
| 11 | Trailing SQL evades classifier | High | **FIXED** — `isSingleStatement` guard (quote-aware) rejects multi-statement input before classification. |
| 12 | Undo token remains replayable | Medium | **FIXED** — undo is one-shot (`undo_already_fired`). |

## PR #2 — console (6 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Undo loses nulled relationships | High | **FIXED** (same fix as PR1 #3). |
| 2 | Fingerprint check is raceable | High | **FIXED** (same fix as PR1 #7). |
| 3 | Concurrent transactions share connection | High | **FIXED** (same fix as PR1 #8). |
| 4 | Arbitrary origins can execute tools | High | **FIXED** — CORS pinned to the console origins (`COUNTERSIGN_ALLOWED_ORIGINS`), no wildcard. |
| 5 | Undo approval is never shown | High | **FIXED** — the Gate renders in WITNESSING too, so `fire_undo`'s pause is visible and answerable. |
| 6 | One click approves every call | High | **FIXED** — approvals resolve per `toolCallId`. |

## PR #3 — agent + tools (8 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | ALTER flow lacks token | High | **FIXED** — reversible simulations now mint a token and require it at commit (with PR1 #5/#6). |
| 2 | Malformed JSON can terminate server | High | **FIXED** — admin body parsing wrapped; malformed input falls back to defaults. |
| 3 | Protect admin database routes | High | **FIXED** — admin routes accept an optional `COUNTERSIGN_ADMIN_TOKEN` shared secret; server binds 127.0.0.1 only. |
| 4 | Parse approval flag separately | High | **FIXED** — `e2e.mjs` takes the first non-flag argument as the order (`--approve` no longer becomes the prompt). |
| 5 | Publish replay fixtures correctly | High | **FIXED** — fixtures copied into `console/public/` and committed; replay path documented in README. |
| 6 | Verification failures abort pipeline | Medium | Accepted behavior — `run_investigation` reports `ready_to_commit:false` with the failing proof; the agent stops per doctrine. |
| 7 | E2E failures exit successfully | Medium | **FIXED** — exit code mirrors the final turn status. |
| 8 | Escape fingerprint count | Medium | Noted — display-only value from our own server; revisit if user content ever reaches that surface. |
