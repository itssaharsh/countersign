# SCRIPT.md — the demo video, shot by shot

The hackathon asks for **"a demo of about three minutes showing the agent working."** Best UI
is judged on *"demo video and running project"*, so the video is half of that track's
evidence, not a formality.

This is the narrated script. [SHOOT.md](SHOOT.md) is its production companion: what triggers
each state, how long it really takes, what has to be reset between takes, and which takes
cannot share a run. Read SHOOT.md before rolling; read this while editing.

- **Total: 2:55.** Every timing below is a measured duration from a live run, not a target.
- **Narration: ~430 words**, which is 2:50 at a deliberate 150 wpm. Leave the gaps silent.
- Record the voiceover **separately** from the screen. The model's thinking time varies by
  more than twenty seconds between runs; a live read will not survive it.
- Say **"the console"**, never "the UI". Say **"measured"**, never "estimated" or "predicted".
- Nothing in the narration is a number the screen does not show at that moment.

---

## Beat 1 · The consent form — 0:00 to 0:16

**Screen.** TrueForge's own default approval dialog: the tool name, the raw JSON arguments.
Not the Countersign console. Hold it still. Do not scroll.

> "This is what an approval looks like in almost every agent shipping today. A tool name. A
> blob of JSON. If I click allow, what happens to the database?
>
> I don't know. And I'm the safety layer.
>
> That's not a control. That's a consent form."

**Cut hard** on "consent form". No transition.

---

## Beat 2 · The claim — 0:16 to 0:32

**Screen.** The Countersign console, cold: a slowly turning sphere of 14,000 points, and the
claim over it in one column. *Every approval gate shows you the command. This one shows you
the consequence.* **Let it sit for three full seconds before you speak.** The turn of the
world is the shot; do not rush it, and do not cut on a static frame.

> "Countersign is the same gate, inverted. Before you are asked to approve anything, three
> things get measured: what dies, whether the undo works, and whether policy allows it.
>
> Until all three land, there is no approve button on this page. Not greyed out. Absent."

**Drag the sphere once, slowly, then let go.** It is the only piece of play in the console
and it tells a judge in one gesture that this is running, not a render. Then leave the mouse
alone: the screen is the argument.

---

## Beat 3 · The order — 0:32 to 0:52

**Screen.** Click the field, paste the order, press **Measure it**. Two things happen at once
and both are worth the frame: the layout splits, transcript left and dossier right, and the
sphere breaks apart into three clusters with light beams drawing the cascade between them.

Order (paste, do not type — typing on camera reads as filler):

```
Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'.
Simulate, verify the undo, evaluate policy, then commit.
```

> "One delete. Six thousand inactive users.
>
> The agent runs on TrueForge. It reaches a custom MCP server that holds the database
> credentials, so the model never sees them, and it opens a transaction it is never allowed
> to commit."

**This is where the run costs 18 to 43 seconds.** Cut the dead middle in the edit; the elapsed
counter climbing in the transcript is the shot that survives.

---

## Beat 4 · The ledger — 0:52 to 1:30

**Screen.** The ledger stamps in complete on its glass panel, with the world still moving
behind it. Rows count up by foreign-key depth. The total turns
`--seal` the instant the ledger is complete, and **hands the red back** a moment later when the
countersign control materialises: only one element in the console wears it at a time. Do not
talk over either transition, and do not be surprised when the number goes black again. That is
the design, and it is worth one line of narration in beat 5.

> "It ran the delete inside a shadow transaction and rolled it back. This is what came out.
>
> Six thousand users. They pull seventeen thousand nine hundred and seventy-one orders.
> Those pull nineteen thousand four hundred and forty-two payments. Every one of those arrows
> is a real foreign key, walked in the real schema.
>
> Thirty-seven more tables lose references but keep every row. That distinction is the whole
> product, and the console never blurs it.
>
> Forty-three thousand four hundred and thirteen rows die."

**Pause two seconds on the total.** It is the only 76-pixel number in the console and this is
the second it exists for.

---

## Beat 5 · The three proofs — 1:30 to 1:47

**Screen.** The three precondition lines, stamped. The world pulls back and the doomed set
draws into a breathing core inside a wide green ring: that ring is the freshness countdown
and its arc is real. Then the countersign control materialises in the gate bar, the red
arriving after the shape.

**Frame this wide.** The ring sweeps out past both columns and the shot only works if both
ends of the arc are in it.

> "Blast radius measured. Undo proven: six thousand of six thousand rows came back in shadow.
> Policy passed: four rules, none blocking.
>
> That ring is the clock on this approval. While it is open, those rows are being watched.
>
> Now the control exists."

---

## Beat 6 · The hold — 1:47 to 2:08

**Screen.** Press and hold. The coral fill crosses the label left to right over 1200ms and
the letterforms invert as it passes them. Release only once it reads COUNTERSIGNED. The gate
clears, the world vortexes, and the receipt prints.

> "Approving is a press and hold, because a click is something you can do by accident.
>
> The commit runs scoped to the exact key set that was fingerprinted. If those rows changed
> while I was reading, the commit reports the drift instead of destroying it."

**The hold is the single most important second in the video.** SHOOT.md says film it
deliberately. A fumbled hold costs the whole take.

---

## Beat 7 · The receipt — 2:08 to 2:24

**Screen.** The receipt, printed. The `Undo armed · verified` chip. Click the collapsed
references line once so it expands, then leave it.

> "The receipt is the record. What was scoped, what was actually deleted, the fingerprint, the
> commit time.
>
> And the undo is armed. Not offered. Proven, before any of this ran."

---

## Beat 8 · It can say no — 2:24 to 2:44

**Screen.** Two cuts, roughly ten seconds each. Both are separate takes; see SHOOT.md.

1. **Stale.** The gate armed, untouched for 120 seconds. The control *withdraws*.
2. **Policy failure.** The `audit_log` order. No gate ever opens.

> "A gate that can only say yes isn't a gate.
>
> Leave this one sitting and the measurement ages out. The control withdraws itself, because
> the evidence behind it expired.
>
> And when policy fails, the agent never asks. There is nothing to approve."

---

## Beat 9 · Close — 2:44 to 2:55

**Screen.** The repo, then the Qodo review trail, then the AI disclosure line in the README.

> "Everything you just watched was measured, not predicted. Every change went through a
> pull request reviewed by Qodo. There is a zero-key replay in the repo, so you can drive
> this yourself without a model key.
>
> Countersign. The approve button that shows you the consequence."

---

## Editing notes

Descript, via Underlord:

- Trim dead air and filler words first, then Studio Sound, then captions.
- **Do not let it add zooms to beats 2, 4 or 5.** Those three are compositions: a push-in
  crops the claim, the ledger total is the wrong shape for a zoom, and cropping beat 5 cuts
  the ends off the freshness ring, which is the whole point of the frame.
- Auto-zoom on the hold (beat 6) and on the chip (beat 7) is worth keeping.
- Captions: on. Judges watch muted more often than not.

## Safety check before export

- **No keys on screen.** The rotor, the `.env`, the TrueForge Settings page: none of them are
  in any frame.
- **TrueForge's own turn view stays off camera** except beat 1's approval dialog. It renders
  tool arguments verbatim and `commit_change` carries `undo_token`. The console redacts it;
  TrueForge does not.
- **Scrub the browser chrome:** no other tabs, no bookmarks bar, no notifications.
- Watch the export once at 1x, muted, with captions on. That is how it will be judged.
