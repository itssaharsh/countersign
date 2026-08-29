# The six operator states

Every state below was reached against the live stack and screenshotted from it — no
mock-ups, no replay unless the step says replay. Where a state is harder to reach than it
looks, that is said plainly rather than smoothed over.

## Before anything

```bash
# one clean estate, no leftover evidence
curl -sX POST 127.0.0.1:8977/admin/reseed        # engine must show 0 simulations
curl -s 127.0.0.1:8977/state | head -c 80

# stack: engine 8977 · TrueForge 8790 (needs SQLITE_PATH, or it starts with no model
# providers and every agent creation 422s) · vite 5199
node agent/create-agent.mjs --real
```

**Reseed between takes.** The console shows the latest simulation, so an uncommitted run
from a previous take leaves the console in INVESTIGATING before you have typed anything.
That is correct behaviour and it will look like a bug on camera.

**Keep TrueForge's own turn view off screen.** It renders tool arguments verbatim, and
`commit_change` carries `undo_token`. The console redacts it; TrueForge does not, and that
cannot be fixed from this repo.

---

## 1 · Empty

**Steps:** reseed, load `http://localhost:5199/`.

**On screen:** the submit field with the placeholder that actually runs, the note *Nothing
runs until you countersign*, and a gate bar reading `waiting: nothing submitted yet`. All
three phase segments are `--rule`: nothing has been reached.

Screenshot: `state-1-empty.png`

---

## 2 · Investigating

**Steps:** paste the order and press **Measure it**.

```
Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'.
Simulate, verify the undo, evaluate policy, then commit.
```

**On screen:** the track lights INVESTIGATING and the header says `working`. The transcript
shows the model's reasoning, then `run_investigation` with an elapsed counter climbing.

**Duration: 20–40 seconds**, and the engine publishes nothing until the tool returns. The
elapsed counter is the only thing moving, and it is the honest answer to "is it stuck?".

Screenshot: `state-2-investigating.png`

---

## 3 · Deciding

**Steps:** wait. TrueForge pauses on `commit_change` on its own.

**On screen:** the ledger — `users 6,000 ← root`, `orders 17,971 CASCADE`,
`payments 19,442 CASCADE`, the SET NULL edges collapsed to one line, and **43,413 rows die**
at 76px in `--seal`. Three preconditions stamped in `--proof`. The gate bar carries the
fingerprint and `HOLD TO COUNTERSIGN`, which did not exist a moment earlier.

**The control is a 1200ms hold.** Press and hold; release early and it resets. `Enter` works
identically with the control focused.

Screenshot: `state-3-deciding.png`

---

## 4 · Witnessing

**Steps:** hold the control for 1200ms.

**On screen:** the receipt prints at ~18ms a line — per-table figures, the fingerprint, the
keys the commit was scoped to shown separately from the root rows actually deleted, and
`UNDO ARMED · verified`. The undo control below it **sends an order**; it does not act. The
gate bar re-arms with `HOLD TO RESTORE`.

Screenshot: `state-4-witnessing.png`

---

## 5 · Refused — two different screens

This is the state most likely to catch you out on camera, because **the obvious route does
not produce the obvious screen**.

### 5a · Policy failure, on the investigating screen (agent-driven)

**Steps:** reseed, then send

```
Process this change request: DELETE FROM audit_log WHERE subject_table = 'users'.
Simulate, verify the undo, evaluate policy, then commit.
```

**On screen:** the ledger measures `audit_log 2,400 ← root`, and the preconditions read

```
✓ BLAST RADIUS MEASURED
✓ UNDO PROVEN            2,400/2,400 restored
✕ POLICY FAILED          protected_tables — deletes rows in protected: audit_log
```

**No gate opens, and that is correct.** The agent sees the failed verdict and does not
request a commit it knows will be refused. The refusal is evidence on the dossier, not a
blocked gate.

The other reachable failure of this kind is `max_rows_deleted`:

```
DELETE FROM users WHERE id <= 17000     →  77,240 rows · FAIL max_rows_deleted (limit 50,000)
```

### 5b · The blocked gate (evidence missing)

**Steps:** replay a recorded gate with no matching engine state —

```
http://localhost:5199/?replayEvents=/fixtures/real-run.jsonl
```

**On screen:** an approval is open, **the countersign control does not exist**, and the bar
reads `waiting: this approval is missing its evidence` with

> The harness is holding an approval whose simulation this console has never seen. Deny it
> and send the order again.

This is the real-world reload case: the page comes back against a restarted engine that no
longer holds the simulation. Deny is the only control offered.

Screenshot: `state-5-refused.png`

---

## 6 · Stale

**Steps:** reach DECIDING (state 3) and **wait 120 seconds without countersigning**.

**On screen:** a countdown appears in the gate bar at 30 seconds remaining. At zero the
control **withdraws** — it does not grey out — and the bar reads:

> these rows were counted 2m 2s ago. The count is no longer current — deny this gate, then
> send the order again for a fresh measurement.

Recorded from the live run, at 2m 2s. The ledger stays on screen so you can see exactly what
expired.

Screenshots: `state-6-countdown.png`, `state-6-stale.png`

**In replay, freshness is anchored to page load** only when the recorded measurement is more
than ten minutes old. A fixture recorded minutes ago reads STALE immediately — correct for a
two-minute-old measurement, but surprising if you re-record and rehearse straight away.

---

## Known deviations

- **The total keeps `--seal` on the STALE screen.** §5 says it should drop to `--ink` when
  the measurement expires. The seal is withheld on failed evidence but not on expired
  evidence; measured at `rgb(179, 36, 28)` after expiry.
- **The send-another-order note mentions the undo in phases where nothing has been
  committed.** Harmless, but it offers a restore that does not exist yet.
