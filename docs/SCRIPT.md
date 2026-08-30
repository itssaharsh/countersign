# SCRIPT.md, the demo video

Written for the deployed demo at **countersign-xi.vercel.app**, which is what is being filmed.
[SHOOT.md](SHOOT.md) is the production companion: what triggers each screen, how long it takes,
what to reset.

**534 words, which is 3:33 read at 150 wpm.** That is over the three minute target on purpose:
read it at 165 to 170 and it lands at 3:05, or drop beat 2 entirely and it lands at 2:50. Beat
2 is the argument, not the demonstration, so it is the one to lose if the cut runs long.

Record the voiceover separately from the screen and cut the picture to the words.

**One thing about pacing on the deployment.** The replay streams while you are still on the
landing, so the gate arrives about two seconds after the click. There is no waiting to fill.
That means the edit holds still frames while the narration runs, rather than the narration
racing to keep up with the screen. Let each screen sit.

**Read it flat.** Every line below is a statement of fact about something visible. Flat and
certain lands harder than energetic, especially on "there is no button".

---

## Beat 1 · What this is 0:00 to 0:18

**On screen.** The landing, still. Do not scroll yet.

> Countersign is an approval layer for destructive database changes.
>
> When an AI agent wants to delete something from your database, it has to ask a person first.
> This is the screen where that question gets asked, and it is the only screen I know of that
> shows you the answer before you have to give one.

---

## Beat 2 · The consent form 0:18 to 0:38

**On screen.** Scroll slowly to the claim. Hold on the number.

> Every agent harness ships human approval, and they all ask the same way. A tool name, some
> JSON, allow or deny.
>
> Nobody can answer that honestly. You cannot see how many rows die, what cascades behind
> them, or whether it can be undone. The person clicking becomes the safety layer with nothing
> to be safe with. That is not a control. It moves the blame.

---

## Beat 3 · The order 0:38 to 0:52

**On screen.** The statement field, then click **Watch the recorded run**.

> Here is one real statement against one real database. Delete the users who have not logged
> in since the start of last year.
>
> Six thousand users. That is what it says.

---

## Beat 4 · What it actually takes 0:52 to 1:22

**On screen.** The section. Hold here. This is the longest beat and the most important frame
in the video.

> Forty three thousand four hundred and thirteen.
>
> The extra thirty seven thousand are orders those users placed, and payments on those orders,
> reached through foreign keys the prompt never mentioned.
>
> Depth down the page is foreign key depth. Bar length is how many rows. Solid means the rows
> are gone. The hatched band is thirty seven tables that keep their rows but lose a reference,
> which is a different thing, and separating those two is the entire product.
>
> None of it is predicted. The statement ran for real inside a transaction that was rolled back.

---

## Beat 5 · The three proofs 1:22 to 1:42

**On screen.** The revision block, A, B and C.

> Blast radius measured across forty one tables.
>
> Rollback proven. The undo ran against a committed copy and six thousand of six thousand rows
> came back. If twelve had failed, this line would say so and we would stop here.
>
> Policy passed. Four rules, evaluated by code. No model anywhere in that verdict.

---

## Beat 6 · The button that did not exist 1:42 to 2:04

**On screen.** The gate bar. Then press and hold for 1.2 seconds and let the fill cross.

> Only now is there a button.
>
> It was not greyed out a moment ago. It was absent, and the bar said what was missing. A
> disabled button still says the action exists. An absent one tells the truth.
>
> And it is a hold, not a click, because a stray click should not be able to do this.

---

## Beat 7 · The receipt 2:04 to 2:20

**On screen.** The receipt printing, and the undo chip.

> It deleted by that exact key list and nothing else. A row that started matching while I was
> reading would have voided the approval instead of dying with it.
>
> The undo is armed and already proven. Firing it gets countersigned the same way.

---

## Beat 8 · It can say no 2:20 to 2:40

**On screen.** Cut to the refused screen, then the stale one.

> This is the same console refusing.
>
> Here the evidence behind the approval is missing, so there is no control at all, only deny.
>
> And here the measurement expired while the operator was reading. The button withdrew. The
> drawing is still true, but the count is two minutes old, and a count you read two minutes
> ago is not a count.

---

## Beat 9 · On your own database 2:40 to 2:56

**On screen.** The connect screen on the landing, then the repository.

> None of this is written against my schema. It reads the database's own constraints, so it
> measures whatever yours declares.
>
> To point it at yours: two connection strings, one for the database the change would touch
> and one for a copy where the rollback gets proven, and a short file of your rules. Your
> credentials stay in the engine. The model only ever sees measurements.

---

## Beat 10 · Close 2:56 to 3:00

**On screen.** The section, held.

> We only delete what we can prove we can restore.

---

## Editing notes

- **Cut the picture to the words, not the reverse.** On the deployment the gate arrives in two
  seconds; hold the frame and let beat 4 breathe over a still section.
- **Do not speed up the hold.** The 1.2 seconds of the fill crossing the control is the single
  most legible second in the video. If anything, hold a beat after it completes.
- **Beat 8 is two separate takes** cut together. Neither can be reached from the run in beats
  3 to 7. SHOOT.md has the URLs.
- Leave the gaps silent. Roughly a third of the runtime has no narration and that is deliberate.

## Before export

- The connect fields must still show the dummy values. No real credential on screen, ever.
- Keep the harness's own turn view out of frame: it renders tool arguments verbatim, and those
  include a token.
- Confirm the demo banner is visible at least once, so nobody can mistake the replay for a live
  database connection.
