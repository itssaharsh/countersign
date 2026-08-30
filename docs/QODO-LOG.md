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

## PR #4 — demo migration: purge inactive users (0 findings)
No Qodo review on this PR — it is the demo *target* PR (unmerged; `migrations/0042_purge_inactive_users.sql`); its only comment is the Countersign receipt posted by the agent.

## PR #5 — README Qodo evidence section (0 findings)
Qodo posted a summary and a clean review ("Great, no issues found!"); no findings.

## PR #6 — PR-origin storyline + sandbox re-verification + receipt-to-PR (7 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Sandbox verification fails open | High | **DISMISSED (reason in-thread)** — mocksmith is the scripted *test driver*, not the enforcement layer; `commit_change` refuses server-side without a recorded deterministic policy PASS regardless of what any model does. The sandbox re-run is redundant evidence; an explicit sandbox FAIL still blocks in the script, and unavailability is reported honestly in the transcript (upstream truefoundry/trueforge#482 on WSL2). |
| 2 | Multiline migrations are corrupted | High | **FIXED** — added-line continuations in the JSON-escaped diff are joined before extraction, so multi-line statements survive intact (downstream also fails safe: a truncated statement fails the server's classifier/simulation, which blocks the flow). |
| 3 | Additional migrations are ignored | High | **DISMISSED (reason in-thread)** — one migration per PR is the v1 demo contract for the scripted driver; the real-model agent doctrine handles multi-file PRs naturally. Noted in the script header. |
| 4 | Receipt targets wrong repository | High | **FIXED** — owner/repo now come from the `pull_request_read` call recorded in history, with the parsed order as fallback. |
| 5 | PR flow lacks design rationale | Rule | Noted — design rationale lives in `docs/EXPLAIN.md`. |
| 6 | Receipt JSON is truncated | Medium | Noted — the receipt embeds a truncated measurement preview by design; the full JSON persists in the evidence dir. |
| 7 | Evidence claims unperformed verification | Medium | Noted — the receipt's verification claims are read from the `run_investigation` result, not asserted. |

## PR #7 — Groq real-model profile + key rotor (5 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Final key bypasses retries | High | **FIXED** — every throttled key (including the last) yields to the next key/cycle; the throttled response is forwarded only after all cycles are exhausted. |
| 2 | Rotation races skip keys | High | **FIXED** — each request snapshots the key ring at start and walks its own consistent order; promotion rotates the shared ring by key identity. |
| 3 | Live setup selects unconfigured provider | High | **FIXED** — README's live setup now documents both paths (catalog provider, or Groq via the rotor with the custom-provider registration and `--real`). |
| 4 | key-rotor design undocumented | Rule | **FIXED** — `docs/EXPLAIN.md` has a design entry for the rotor and the lean profile, including the "isn't the mock cheating?" judge answer. |
| 5 | Hung upstream blocks failover | Medium | **FIXED** — upstream fetch carries a 120 s AbortSignal timeout, so a stalled connection falls through to the next key. |

## PR #8 — same-turn commit doctrine + gate-aware demo driver (1 finding)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Null arguments crash event handling | Medium | **FIXED** in PR #9 — `safeParse` returns `{}` for null/non-string arguments and `unwrapCall` only unwraps when `tool_name` is a string (noted on the PR #8 thread). |

## PR #9 — console doubled tool-call argument recovery (2 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Recovery cannot unblock gate | High | **FIXED** — the branch lacked the `call_tool` unwrap, so `toolName` stayed `call_tool`; both are now in the branch, verified by replaying a recorded gpt-oss-120b session through the console (`?replayEvents=/fixtures/real-run.jsonl` → `HUMAN GATE · commit_change` renders). |
| 2 | Argument recovery is undocumented | Rule | **FIXED** — `docs/EXPLAIN.md` entry added (also notes the retracted upstream report). |

## PR #10 — console redesign: bright, colourful, animated (6 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Stale evidence becomes fresh | High | **FIXED** — the page-load anchor now applies only when `?replay` / `?replayEvents` is present; live runs keep the true measurement timestamp, so stale live evidence renders STALE and the button stays disabled. |
| 2 | Redesign decisions remain undocumented | Rule | **FIXED** — `docs/EXPLAIN.md` has a "visual system" entry (rationale, references, what the 3D world represents, reduced-motion behaviour). |
| 3 | App lacks TrueForgeUI provider | Rule | **FIXED** as a docs bug — the console is deliberately built on `@truefoundry/trueforge-sdk` directly (the UI embed loops against server 0.1.4, documented in EXPLAIN.md); CLAUDE.md's stale architecture section is now synced. |
| 4 | Replay still polls live server | Rule | **FIXED** — event replay without a state fixture no longer polls `/state`. |
| 5 | Backend status is fabricated | Medium | **FIXED** — the header chip reads the countersign agent's model from TrueForge (`/api/v1/agents`) and shows "engine offline" when the engine is unreachable. |
| 6 | Motion preference is ignored | Medium | **FIXED** — `prefers-reduced-motion` disables the decorative animations and skips mounting the 3D scene and particle field. |

## PR #11 — console v4 cinematic stage (9 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Approval arms without evidence | High | **FIXED** — the pending approval's `args.simulation_id` is matched against engine simulations; no loaded match = gate **BLOCKED · missing: simulation evidence** (verified in replay-only mode). |
| 2 | Reversible changes bypass proofs | High | **FIXED** — verified undo + policy PASS required for every kind; blast-radius requirement stays kind-specific; `fire_undo` requires a committed change. |
| 3 | Failed undo warning removed | Rule | **FIXED** — proof line reads `NOT RESTORED BY THE GENERATED ROLLBACK` when an undo report exists and verification failed. |
| 4 | Console v4 design undocumented | Rule | **FIXED** — `docs/EXPLAIN.md` v4 "cinematic stage" entry replaces the v3 one. |
| 5 | Transcript cannot be scrolled | Medium | **FIXED** — rail is interactive (`.hit`), auto-follows the newest line. |
| 6 | Critical panels clip on phones | Medium | **FIXED** — viewport-constrained `.panel` widths + `max-width: 720px` layout block with internal overflow. |
| 7 | Reduced motion still animates | Medium | **FIXED** — `useReducedMotion` gates the stage: settle for 2.5 s after a phase change, then hold; autorotate and beam dashes stop. |
| 8 | Reduced-motion cursor disappears | Medium | **FIXED** — native cursor restored on `a, button, input, .hit` under the media query. |
| 9 | Stage performs excessive frame work | Medium | **PARTIALLY FIXED (reason in-thread)** — per-point `Vector3` allocations removed; the full-array lerp per frame is kept because the galaxy *is* the state readout (one 168 KB upload per frame at 14k points). |

## PR #12 — console v5 scroll story (3 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | No undo phrasing nonstandard | Rule | **FIXED** — the Problem card no longer makes a recovery claim; it states the fact: "No rollback was ever generated." The mandated phrase stays reserved for the console's own failed-undo state. |
| 2 | Repeated orders disappear | Bug | **FIXED** — user orders are identified by turn (`u-<turnId>`); a live `send()` places a `u-pending-*` item that is reconciled with its `turn.created`, so repeated identical orders each keep their own line. |
| 3 | Scroll jump skips fade | Bug | **FIXED** — the scroll-derived material opacity is applied before the geometry loop's early return, so a jump straight into the story lands on the faded galaxy. |

## PR #13 — console v5.1 one world (3 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Invisible wayfinder receives focus | Bug | **FIXED** — the rail is `inert` and `aria-hidden` while transparent (tracked from the scroll motion value) and focused labels are shown. |
| 2 | Counters ignore reduced motion | Bug | **FIXED** — `NumberTicker` writes the final value immediately under `prefers-reduced-motion`; no spring is subscribed. |
| 3 | Mobile dock exceeds height | Bug | **FIXED** — mobile `--dock-h` is 204px; measured content 38+38+1+48 with gaps and padding fits with no overflow. |

## PR #14 — reopen pending gates after reload (3 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Questions cannot be reopened | Bug | **FIXED** — `tool.response_required` is held like a gate (rehydrated on reload too), rendered in the rail with the question text, and answered with `user.tool_response`. |
| 2 | Recovery failure hides error | Bug | **FIXED** — if rehydration fails, both the rehydration error and the original stream error are posted. |
| 3 | Gate rehydration design undocumented | Rule | **FIXED** — EXPLAIN "Reopening a gate after a reload" covers the ordering, the reducer replay, questions, error handling and the trade-off. |

## PR #15 — start-over escape hatch (3 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Undo stale guidance loops | Bug | **FIXED** — the freshness timer applies to the commit gate only; `fire_undo` is never marked STALE and its line states the one-shot, committed-state condition instead. |
| 2 | startOver exits fixture replay | Rule | **FIXED** — the reload keeps the query string, so in judge mode start over restarts the fixture stream rather than entering live mode. |
| 3 | Start-over decision undocumented | Rule | **FIXED** — EXPLAIN "Start over" entry: why the saved session is removed, why a full reload, what URL state is kept, replay trade-off. |

## PR #16 — the console spec (0 findings)
Docs only. Clean on the first pass: `🐞 Bugs (0) 📘 Rule violations (0) 📎 Requirement gaps (0)`.
A follow-up commit corrected §2 against reality before merge — Bricolage Grotesque's width axis
runs 75–100 on Google Fonts rather than 100–120, and dark mode needed re-struck `--graphite`,
`--seal` and `--proof`, because the light values measure 3.4:1, 2.9:1 and 1.7:1 on an ink ground,
all under the 4.5:1 floor §8 calls non-negotiable. Both were found while implementing the tokens,
not by re-reading the spec.

## PR #17 — console ground: tokens and type (3 findings)
| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Focus ring remains suppressed | Bug | **FIXED** — the v5.1 structural rules carried `outline: none` on `.cmd` and focused `.tbtn` and won the cascade over the new global `:focus-visible`, so the command line and the action buttons had no ring at all. Restored explicitly on every legacy control. Verified by computed style: `2px solid rgb(20,18,14) offset 2px`, `:focus-visible = true`. |
| 2 | Mobile subtitle overlaps dock | Bug | **FIXED** — the root cause was not the subtitle: the dock reserved a fixed 204px while its own first line wrapped to three at 390px. Inter Tight sitting taller than the italic it replaced made an existing overflow visible. Order line clamped, reservation corrected. Verified by bounding box: subtitle bottom 600, dock top 612, gap 12px. |
| 3 | Ground redesign lacks rationale | Rule | **FIXED** — `docs/EXPLAIN.md` still presented the v4 cinematic stage as current. Added the v6 counterfoil entry: why the stage was dropped against the Best UI judging line, why rationing one red element needs a light ground, the spectacle given up, the dark-mode contrast values, and the temporary bridge. |

## PR #18 — the countersign gate (13 findings, 5 rounds)
The deepest review in the project, on the one control whose entire job is to be trustworthy.
Four correctness bugs reached the branch; none were reachable through the local tests, because
every one of them lived in a state those tests never entered.

| # | Finding | Sev | Outcome |
|---|---|---|---|
| 1 | Stale hold still approves | Bug | **FIXED** — the frame loop never rechecked `enabled`, so a hold begun at t=119s landed the approval at t=120.2s, after the control had withdrawn for staleness: an irreversible commit authorised on evidence the console had already rejected. Reads `enabled` through a ref every frame and aborts. Verified against the real 120s clock — hold started with 1s left, expiry landed mid-hold, no approval sent. |
| 2 | Completed hold blocks later gates | Bug | **FIXED** — `done.current` was never reset and one gate bar serves every gate in a session, so after countersigning the commit the undo's RESTORE control would have rendered permanently labelled COUNTERSIGNED and refused to start. Completion is per-gate now, keyed on the pending `toolCallId`. |
| 3 | Focus loss preserves hold | Bug | **FIXED** — the hold was cancelled by keyup or *window* blur, and window blur does not fire when focus merely moves elsewhere on the page. Tabbing away mid-hold left the timer running and the approval landed after the sustained intent had ended. Cancels on blur. |
| 4 | Declined answer crosses questions | Bug | **FIXED** — an approval and a question can be pending at once; a single coalesced identity key (`approval ?? question`) stayed pinned to the approval while questions came and went, so a later question arrived prefilled with a previous question's text. Approval and question now carry separate identities, and the hold keys on the approval alone. |
| 5 | Denial reason crosses gates | Bug | **FIXED** — initially dismissed as a stale re-anchor, which was wrong. The reset ran in a `useEffect`, and an effect fires after paint, so the first frame of a new gate still carried the previous gate's text. Both field and hold resets moved to render time. |
| 6 | Question gate lacks denial | Bug | **FIXED** — §4 requires an escape on every open gate and the question branch shipped without one. Worse than a missing button: the harness refuses `send()` while anything is pending, so an unanswerable question would have deadlocked the session. Declining resolves through the question protocol (`user.tool_response`), never with an approval response. |
| 7 | Gate motion ignores preference | Bug | **FIXED** — the materialise/withdraw ran its 200ms scale unconditionally. Instant under `prefers-reduced-motion`; the hold duration is unchanged, because reducing motion must not reduce the commitment. |
| 8 | Gate inputs lose focus ring | Bug | **FIXED** — `.gate-input:focus-visible` set `outline: none`, the exact pattern PR #17 established as a bug, reintroduced two PRs later in the file that documents the rule. |
| 9 | Wrapped gate exceeds fixed height | Bug | **FIXED** — the bar wrapped inside a fixed 88px and overflowed. `min-height` now, mobile rows stack deliberately, and the bar publishes its measured height so every offset that must clear it follows the real number. |
| 10 | Refusal detail shares row | Bug | **FIXED** — `.gate-refusal` was a flex sibling of `.inner` in a horizontal bar, so the blocked-state explanation was squeezed beside the controls. The `grid-column` rule written for it was dead code: the element is not a child of either mobile grid. |
| 11 | Replacement gate auto-approves | Bug | **FIXED** — resolved by the same per-gate reset as #2. |
| 12 | RefusalDetail omits rollback phrase | Rule | **FIXED** — failed-rollback copy must read `NOT RESTORED BY THE GENERATED ROLLBACK`; it now leads with it. |
| 13 | Gate lacked a REFUSED/STALE surface | — | Built in the same PR, and verified: STALE reached by waiting out the real 120s window, REFUSED by loading a gate with no matching simulation. |

**Two of our own assertions passed by measuring the absence of a different bug.** The REFUSED
check asserted the bar did not overlap the dock and the control was absent; both were true while
the refusal text was squeezed into a narrow column beside the inputs, so a broken layout read as
verified. And the first stale-hold regression test reported a failure that was not one — it
started the hold with three seconds left, where completing before expiry is correct. A test that
can only pass is worth as little as one that can only fail. Both lessons are recorded in the
README's review-evidence section rather than quietly fixed.
