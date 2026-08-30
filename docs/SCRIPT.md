# SCRIPT.md

The demo video, as read. Everything in a blockquote is spoken. Everything else is what to put
on screen. Verified shot by shot against the deployed build.

Read it flat. Every line is a statement of fact about something visible.

Nine shots, covering the four things the submission asks for, in this order: what the project
is (1), a working demo (2 to 7), the stack and architecture (8), and what building it taught
(9). 451 words, which is 2:54 read at a normal pace.

---

### 1 · The landing, top of the page, still

Open it with the filming window on, so the gate in shots 3 to 6 does not expire mid take:

```
https://countersign-xi.vercel.app/?freshness=1200
```

> Countersign is an approval layer for destructive database changes.
>
> When an agent wants to delete from your database it asks first, and every harness asks the
> same way: a tool name, some JSON, allow or deny.
>
> Nobody can answer that honestly. The click becomes the safety layer, with nothing behind it.

---

### 2 · Same page, scrolled down to THE CHANGE TO MEASURE. Show the statement, then click WATCH THE RECORDED RUN

> One real statement, against one real database. Delete the users who have not logged in since
> the start of last year.
>
> Six thousand users. That is what it says.

---

### 3 · The run screen, right hand panel. The longest shot

Five bars under BLAST RADIUS BY FOREIGN KEY DEPTH, then the big 43,413 below them. Stay on
this for twenty seconds longer than the narration needs; the tail becomes shot 9.

> Forty three thousand four hundred and thirteen.
>
> The extra thirty seven thousand are orders those users placed, and payments on those orders,
> reached through foreign keys the prompt never mentioned.
>
> Solid means the rows are gone. Hatched means they survive and lose a reference, and
> separating those two is the whole product.

---

### 4 · Same screen, scrolled down a little

The A / B / C lines sit below the fold at a 900px window, so scroll until all three are on
camera before you start speaking.

> None of it is predicted. The statement ran for real on a shadow copy, in a transaction that
> was rolled back. Then the undo ran, and six thousand of six thousand rows came back.
>
> Policy passed. Four rules, evaluated by code. No model in that verdict.

---

### 5 · The bottom bar of the run screen. Press HOLD TO COUNTERSIGN and hold it for a second and a half

> Only now is there a button.
>
> A moment ago it was not greyed out. It was absent, and the bar said what was missing.
>
> And it is a hold, because a stray click should not do this.

---

### 6 · The right hand panel again, where the receipt replaces the bars

> It deleted by that exact key list and nothing else. A row that started matching while I read
> would have voided the approval instead of dying with it.

---

### 7 · Two separate recordings, cut together

**First**, this URL in a fresh tab. Give it about twelve seconds to settle.

```
https://countersign-xi.vercel.app/run?replayEvents=/fixtures/real-run.jsonl
```

The panel says THE CHANGE and offers MEASURE IT. The bottom bar reads *nothing measured yet*
on the left, and on the right *waiting: this approval is missing its evidence* with only a
reason box and Deny. Frame the bottom right, where HOLD TO COUNTERSIGN was in shot 5.

**Second**, a fresh tab on the plain URL, with no `freshness` parameter, so the window is back
to its normal 120 seconds. Click through to the run, reach the gate, and leave it completely
alone for two minutes. Two things change on their own: the 43,413 turns
red, and HOLD TO COUNTERSIGN disappears. The bottom bar then reads *these rows were counted
2m 17s ago. The count is no longer current. Deny this gate, then send the order again for a
fresh measurement*, with only Deny beside it.

Start this tab before you record anything else and let it age in the background, or it is two
dead minutes on the clock.

> The same console, refusing. The agent is still asking, but the measurement is gone, so there
> is nothing to countersign.
>
> And here it simply got old. The button withdrew on its own: a count you read two minutes ago
> is not a count.

---

### 8 · Back on the landing, scrolled to CONNECT YOUR DATABASE

Four fields across, LIVE DATABASE, SHADOW DATABASE, AGENT HARNESS, COUNTERSIGN ENGINE, with
MODEL KEY underneath. Partway through the narration, click **show the resolved environment**
and let the printed variables sit on screen.

> The stack is those four fields.
>
> The agent runs in a TrueForge harness. When it reaches a destructive tool, the harness stops
> and asks. That pause is where the work happens.
>
> A Node MCP server does it: a transaction on a shadow Postgres, the statement run for real,
> the foreign keys walked out of Postgres's own catalog, then a rollback. It fingerprints the
> rows, runs the policy file, and sends only the verdict to the browser.
>
> To run it on yours: two connection strings, a rules file, and one line in the agent config
> naming the irreversible tools. It reads your foreign keys, not my schema, and credentials
> never leave the engine.

---

### 9 · The tail of shot 3, held still on 43,413

Not a new recording. The receipt has replaced the bars by this point in the run, so this is
the twenty seconds you left running at the end of shot 3.

> What I got wrong first was trusting the count in the request. Six thousand is not a lie. It
> is just the only number the agent can see.
>
> An agent asking permission is not safety. Showing you the consequence before you answer is.
>
> We only delete what we can prove we can restore.

---

## Production notes

- Record the voiceover separately and cut the picture to the words. On the deployed build the
  gate arrives about two seconds after the click, so the edit holds still frames while the
  narration runs.
- Shot 7's first clip cannot be reached from the run in shots 2 to 6. It is its own URL.
- Shot 8 is the longest block of narration over the least motion. Cut between the connect
  fields and the resolved environment reveal partway through it.
- Do not speed up the hold in shot 5. That second and a half is the most legible moment in
  the video.
- `?freshness=1200` widens only what the console shows you. It is there so a re-take does not
  cost you the whole measurement. Leave it off for shot 7's second clip, which is the one that
  needs the window to actually run out.
- The narration is continuous. It fits three minutes with about six seconds to spare, so cut
  the picture underneath it rather than pausing between shots.

## Before export

- The connect fields must still show the dummy values. No real credential on screen.
- Keep the harness's own turn view out of frame: it renders tool arguments, and those include
  a token.
- The demo banner should be visible at least once, so nobody mistakes the replay for a live
  database connection.
