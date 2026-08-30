# SCRIPT.md

The demo video, as read. Everything in a blockquote is spoken. Everything else is what to put
on screen. Verified shot by shot against the deployed build.

Read it flat. Every line is a statement of fact about something visible.

---

### 1 · The landing, still

> Countersign is an approval layer for destructive database changes.
>
> When an AI agent wants to delete something from your database, it asks a person first. Every
> harness asks the same way: a tool name, some JSON, allow or deny.
>
> Nobody can answer that honestly. The person clicking becomes the safety layer with nothing
> to be safe with.

---

### 2 · The statement field, then click Watch the recorded run

> Here is one real statement against one real database. Delete the users who have not logged
> in since the start of last year.
>
> Six thousand users. That is what it says.

---

### 3 · The section. Hold here, this is the longest shot

> Forty three thousand four hundred and thirteen.
>
> The extra thirty seven thousand are orders those users placed, and payments on those
> orders, reached through foreign keys the prompt never mentioned.
>
> Depth down the page is foreign key depth. Solid means the rows are gone. The hatched band is
> thirty seven tables that keep their rows but lose a reference, which is a different thing,
> and separating those two is the entire product.
>
> None of it is predicted. The statement ran for real, inside a transaction that was rolled back.

---

### 4 · The revision block

> Blast radius measured across forty one tables.
>
> Rollback proven. The undo ran against a committed copy and six thousand of six thousand
> rows came back.
>
> Policy passed. Four rules, evaluated by code. No model anywhere in that verdict.

---

### 5 · The gate bar, then press and hold for a second and a half

> Only now is there a button.
>
> It was not greyed out a moment ago. It was absent, and the bar said what was missing.
>
> And it is a hold, not a click, because a stray click should not be able to do this.

---

### 6 · The receipt printing, and the undo chip

> It deleted by that exact key list and nothing else. A row that started matching while I read
> would have voided the approval instead of dying with it.
>
> The undo is armed and already proven. Firing it gets countersigned the same way.

---

### 7 · Fresh tab, this URL, wait about twelve seconds

```
https://countersign-xi.vercel.app/run?replayEvents=/fixtures/real-run.jsonl
```

Point the camera at the empty space where the button was in shot 5.

> This is the same console, refusing.
>
> The agent is still asking, but the measurement behind the request is gone. There is nothing
> to countersign, and the only control here is deny.

---

### 8 · The expired gate. Reach the gate, then leave it alone until the window runs out

> And here the measurement simply got old.
>
> The button withdrew on its own, because a count you read two minutes ago is not a count.
>
> Nothing is lost. Ask again and it measures again.

---

### 9 · Back to the landing. Show the connect fields, then click show the resolved environment and let the variables sit on screen

> Here is what it takes to run this against your own database.
>
> Two connection strings. One for the database the change would touch, one for a copy where
> the rollback gets proven.
>
> A short file of your rules: how many rows may die, which tables must never lose any.
>
> And one line in the agent's config, pinning the irreversible tools so the harness stops and
> asks.
>
> None of the measurement is written against my schema, so it works on yours. It reads your
> database's own foreign keys. And your credentials stay in the engine. They never reach the
> browser, and they never reach the model.

---

### 10 · The section, held still on the number

> An agent asking permission is not safety. Showing you the consequence before you answer is.
>
> We only delete what we can prove we can restore.

---

## Production notes

- Record the voiceover separately and cut the picture to the words. On the deployed build the
  gate arrives about two seconds after the click, so the edit holds still frames while the
  narration runs.
- Shots 7 and 8 are separate recordings. Neither can be reached from the run in shots 2 to 6.
- Do not speed up the hold in shot 5. That second and a half is the most legible moment in
  the video.
- Leave the gaps silent.

## Before export

- The connect fields must still show the dummy values. No real credential on screen.
- Keep the harness's own turn view out of frame: it renders tool arguments, and those include
  a token.
- The demo banner should be visible at least once, so nobody mistakes the replay for a live
  database connection.
