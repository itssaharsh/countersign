# SCRIPT.md, the demo video

Written for the deployed demo at **countersign-xi.vercel.app**, which is what is being filmed.
[SHOOT.md](SHOOT.md) is the production companion: what triggers each screen, how long it takes,
what to reset.

**622 words, which is 4:09 read at 150 wpm.** The hackathon asks for about three minutes, so
this needs cutting and here is the order to cut in:

1. **Drop beat 2** (the consent form). It is the argument, not the demonstration, and beat 1
   already implies it. Saves about 20 seconds.
2. **Halve beat 4's middle paragraph**, the one explaining solid versus hatched. Keep the first
   and last lines. Saves about 15 seconds.
3. **Read at 165 wpm** rather than 150. Saves about 25 seconds.

All three together land it at roughly 2:55. Do not cut beat 9: it is the only part that tells a
viewer how to use the thing, and a demo that never says that is a trailer.

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

## Beat 8 · The two ways it refuses, 2:20 to 2:48

Everything so far has been the console saying yes. This beat is the console saying no, and it
says no in two different ways for two different reasons. **They are two separate recordings,
cut together.** Neither can be reached from the run you just filmed.

### 8a · No evidence, so no button

**How to get this screen.** Open this URL in a fresh tab and wait about twelve seconds:

```
https://countersign-xi.vercel.app/run?replayEvents=/fixtures/real-run.jsonl
```

**What you are looking at.** The agent is asking to commit, exactly as before. But the
measurement that would justify it is not there. This is the real world case where the page was
reloaded against a restarted engine: the harness still holds the approval, the console has no
idea what it is for.

**What is on screen.** The gate bar at the bottom, with **Deny** and nothing else. Point the
camera at the empty space where the countersign control was in beat 6.

> This is the same console, refusing.
>
> The agent is still asking. But the measurement behind the request is gone, so there is
> nothing to countersign, and the only control here is deny.

### 8b · The measurement expired

**How to get this screen.** Reach the gate normally, then leave it alone until the window runs
out. You already have this take by accident.

**What you are looking at.** The count was true when it was taken. Then time passed. A row
could have started matching while the operator was reading, so the signature is no longer
about the rows on screen.

**What is on screen.** The section still drawn, the number still there, and the gate bar
carrying the expiry line. The control has withdrawn.

> And here the measurement simply got old.
>
> The count was true when it was taken. The button withdrew on its own, because a count you
> read two minutes ago is not a count.
>
> Nothing is lost. Ask again and it measures again.

---

## Beat 9 · How you point it at your own database, 2:40 to 3:20

**On screen, in this order.** Scroll back to the landing. Show the connect fields. Click
**show the resolved environment** so the block of variables appears on screen. Then cut to the
repository README.

The variables are the whole answer, so let them sit long enough to read.

> Here is what it takes to run this against your own database.
>
> Two connection strings. One for the database the change would touch. One for a copy of it,
> where the rollback gets proven before you are asked to approve anything.
>
> A short file of your rules. How many rows may die. Which tables must never lose any.
>
> And one line in the agent's config, pinning the two irreversible tools so the harness stops
> and asks.
>
> That is the whole setup. Nothing in the measurement is written against my schema, so it
> works on yours: it reads your database's own foreign keys and measures what they say.
>
> Your credentials stay in the engine's environment. They never reach the browser and they
> never reach the model. The model sees measurements and a single use token, and that is all.

---

## Beat 10 · Close, 3:20 to 3:30

**On screen.** Back to the section, held still on the 43,413.

> An agent asking permission is not safety. Showing you the consequence before you answer is.
>
> We only delete what we can prove we can restore.

---

## Editing notes

- **Cut the picture to the words, not the reverse.** On the deployment the gate arrives in two
  seconds; hold the frame and let beat 4 breathe over a still section.
- **Do not speed up the hold.** The 1.2 seconds of the fill crossing the control is the single
  most legible second in the video. If anything, hold a beat after it completes.
- **Beat 8 is two separate takes** cut together. Neither can be reached from the run in beats
  3 to 7. SHOOT.md has the URLs.
- **Beat 9 needs the environment block visible.** The connect screen has a *show the resolved
  environment* link that prints the variables. That block is the proof the setup is four lines
  rather than a rewrite, so hold it long enough for a viewer to read it.
- Leave the gaps silent. Roughly a third of the runtime has no narration and that is deliberate.

## Before export

- The connect fields must still show the dummy values. No real credential on screen, ever.
- Keep the harness's own turn view out of frame: it renders tool arguments verbatim, and those
  include a token.
- Confirm the demo banner is visible at least once, so nobody can mistake the replay for a live
  database connection.
