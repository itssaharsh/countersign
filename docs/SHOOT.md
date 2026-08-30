# SHOOT.md — filming the six states

Timings are measured from runs against the live stack on `main`, not estimated. The model's
thinking time varies between takes; the observed spread is recorded where it matters.

No narration here. Clip lengths are what they are; the voiceover is written against them in
[SCRIPT.md](SCRIPT.md), which is the beat-by-beat script this file supports.

---

## Before you roll

**Reseed between takes.** Every take that commits, or that leaves an uncommitted simulation,
changes what the next take opens on. The console shows the latest simulation, so a leftover
run puts you in INVESTIGATING before you have typed anything.

```bash
curl -sX POST 127.0.0.1:8977/admin/reseed && curl -s 127.0.0.1:8977/state | head -c 60
# must print  {"simulations":[],...
```

**Keep TrueForge's turn view off camera.** It renders tool arguments verbatim and
`commit_change` carries `undo_token`. The console redacts it; TrueForge does not, and that
cannot be fixed from this repo. Filming the console only is safe.

**Stack must be up, in this order.** Engine 8977, TrueForge 8790 **with `SQLITE_PATH` set**,
Vite 5199, agent created with `--real`. TrueForge started without `SQLITE_PATH` answers `200`
on every endpoint while having no model providers, and agent creation fails with a 422 — a
failure that looks like the app is fine.

**Model timing varies.** Order-to-gate was 18.9s, 22.5s, 39.2s and 42.7s across four recorded
runs. Budget for 45s and cut it down; do not plan a fixed-length hole.

**Replay freshness.** A fixture recorded less than ten minutes ago replays as STALE, because
the freshness anchor only rewrites measurements older than that. If you re-record fixtures,
wait ten minutes before filming any replay-based shot.

---

## Where things are on screen

Measured at **1440x900** against current `main`. The empty state is one centred column; the
transcript column arrives with the first agent event and everything on the right shifts.

| Control | State 1 (empty) | After the send |
| --- | --- | --- |
| Order input | **(435, 520)** | (848, 484) |
| **Measure it** | **(167, 610)** | (564, 590) |
| `HOLD TO COUNTERSIGN` | — | **(1227, 857)**, 265x54 |
| Deny | — | (1060, 857), 38x36 |
| Fingerprint (read-only) | — | (172, 857) |
| The 43,413 total | — | (893, 496) |
| Collapsed SET NULL line | — | (930, 374) — click to expand |
| Transcript column | — | x 104-484, full height |
| Phase track | (954, 27) | (860, 27) |

In WITNESSING the receipt is 1054px tall, so **the undo control at (655, 1162) is below the
fold**. Scrolling is required to reach it; the gate bar stays fixed while everything else
moves. Decide before rolling whether a take includes that scroll.

**Let the page settle for five seconds before the first click.** The stage canvas is fixed
behind the console and, for a moment after load, takes the click before the button does. A
first click on **Measure it** that appears to do nothing is this, not a broken app.

---

## The six states

### 1 · Empty
**Trigger.** Reseed, load `http://localhost:5199/`.
**Duration.** Static, hold as long as you like.
**On screen.** The cover: the claim at Display 44, the submit field with the placeholder that
actually runs, *Nothing runs until you countersign*, and the three measurements listed as
pending. Gate bar `waiting: nothing submitted yet`, all three phase segments in `--rule`.
**Hold it for two seconds before speaking** (SCRIPT.md beat 2). One column here; the
transcript column arrives with the first agent event.
**Reset after.** None — nothing has run.

### 2 · Investigating
**Trigger.** Paste the order, press **Measure it**.

```
Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'.
Simulate, verify the undo, evaluate policy, then commit.
```

**Duration.** ~0.9s to the first transcript line, then **18–43s of the agent working**.
**On screen, in order.** The layout splits into two columns → phase track lights INVESTIGATING
and the header reads `working` → the model's reasoning appears in the transcript →
`run_investigation` with an elapsed counter climbing → the dossier lists the three pending
measurements → nothing else moves until the tool returns.
**Reset after.** Reseed — a simulation now exists.

### 3 · Deciding
**Trigger.** None. TrueForge pauses on `commit_change` by itself.
**Duration.** Arrives 18–43s after the send. Holds for 120s, then becomes state 6.
**On screen, in order.** Ledger rows count up by foreign-key depth → the SET NULL edges
collapse to one line → **43,413 rows die** at 76px turns `--seal` → three preconditions stamp
in `--proof` → the countersign control materialises last, the red arriving after the shape.
**Reset after.** Reseed.

### 4 · Witnessing
**Trigger.** Press and hold the control for 1200ms. Releasing early resets it.
**Duration.** Receipt appears ~8s after the hold begins — the agent resumes, then commits —
and finishes printing ~1.2s later.
**On screen, in order.** Control fills left to right → `COUNTERSIGNED` → gate clears → ground
shifts to the `--proof` tint → receipt prints line by line → `UNDO ARMED · verified`. The 37
`SET NULL` tables are collapsed to one line; click it once if you want the full list on
camera.
**Reset after.** **Mandatory reseed.** 6,000 users are actually gone.

### 5a · Refused, policy failure
**Trigger.** Reseed, then:

```
Process this change request: DELETE FROM audit_log WHERE subject_table = 'users'.
Simulate, verify the undo, evaluate policy, then commit.
```

**Duration.** Same shape as state 2, usually shorter — fewer tables to measure.
**On screen.** Ledger measures `audit_log 2,400 ← root` → preconditions stamp → the third
reads `✕ POLICY FAILED · protected_tables — deletes rows in protected: audit_log`.
**No gate opens.** The agent will not request a commit it knows will be refused. If you are
waiting for a blocked gate here, you will wait forever.
**Reset after.** Reseed.

### 5b · Refused, blocked gate
**Trigger.** Replay with no engine state behind it:

```
http://localhost:5199/?replayEvents=/fixtures/real-run.jsonl
```

**Duration.** Gate appears within ~7s of load.
**On screen.** An approval is open · **no countersign control at all** · `waiting: this
approval is missing its evidence` · the refusal names the cause · Deny is the only control.
**Reset after.** None. This shot never touches the engine, so it can be filmed at any point —
including while a reseed runs for another take.

### 6 · Stale
**Trigger.** Reach state 3 and **do not countersign**.
**Duration.** **120s of real waiting.** The countdown appears at 30s remaining.
**On screen, in order.** Countdown appears in the gate bar → reaches zero → the control
**withdraws** rather than greying out → the bar reads *these rows were counted 2m 2s ago…* →
the ledger stays up and the total **remains red** (DEMO-STATES.md carries this as a narration
point).
**Reset after.** Reseed.

---

## What cannot be filmed in one continuous run

- **States 1 → 2 → 3 → 4 are one continuous take**, roughly 35–60s end to end. That is the
  spine of the video and the only sequence that flows without a cut.
- **State 6 forks from state 3.** You cannot film 4 and 6 in the same run: countersigning ends
  the gate, waiting expires it. Two separate takes that share an identical first 25 seconds.
- **State 5a needs its own order**, so it cannot join the main run.
- **State 5b is replay by design** — the blocked gate is the reload-against-a-restarted-engine
  case, and staging it live would mean restarting the engine mid-take.

---

## Suggested shot order

Ordered to minimise reseeds, and to put the two hardest takes first while you are fresh.

| # | Take | Reset before | Why here |
|---|---|---|---|
| 1 | **State 6 — stale** | reseed | Hardest. Long, one-shot, payoff is a single transition. Do it first and re-do it freely. |
| 2 | **States 1→4 — the spine** | reseed | Second hardest, and the take everything else supports. |
| 3 | State 5a — policy failure | reseed | Same shape as the spine, low risk once take 2 is in the can. |
| 4 | State 5b — blocked gate | none | Replay only. Can also fill the gap while a reseed runs. |
| 5 | Pickups — empty state, ledger detail, receipt detail | reseed once | Static frames, re-shootable off the state-1 and state-4 screens. |

One reseed before each of takes 1, 2, 3 and 5. Take 4 needs none.

---

## The two hardest takes, and why

**1 · State 6, stale.** Each attempt costs a reseed, ~25s to the gate, then **120 seconds of
dead air** before the moment you are filming — and that moment is one frame: the control
withdrawing. Get it wrong and the whole cycle repeats. Two specific traps: countersigning by
reflex ends the take, and the countdown does not appear until 30s remain, so there is a
90-second stretch where nothing on screen changes and it looks like a hang.

**2 · States 1→4, the spine.** This take carries the hold, the single most important second in
the video, and it sits behind **18–43s of variable model time**. A fumbled hold — released
early, or the pointer drifting off the control — costs the whole run plus a reseed. Film the
hold deliberately: press, watch the fill cross the label, release only once it reads
`COUNTERSIGNED`.
