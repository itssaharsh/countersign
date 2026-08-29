# DESIGN.md — Countersign console

The single source of truth for visual and interaction decisions. Claude Code: read this
file fully before touching any component. Do not invent colors, fonts, or animations that
are not in here.

Every number, table name and state in this document is taken from the recorded real-model
run (`console/public/fixtures/real-run.jsonl`, simulation `cdac3df6`, gpt-oss-120b) or from
the engine source. Nothing here is illustrative. If a screen in this spec cannot be drawn
from data the console actually receives, that is a bug in the spec, not a licence to
invent the data. See §9 for the record of where the spec was corrected against reality.

---

## 0. What is being designed

**Not** a marketing landing page. The artifact is the **operator console** — the screen a
person sits in front of while a TrueForge agent investigates a destructive database change
and waits to be countersigned.

The judging line for the Best UI track is: *an interface that shows what the agent is
doing, what it is waiting on, and what it did, and asks before the irreversible step
rather than after it — judged on the demo video and on the running project.*

So the console must answer three questions at every moment, without the user scrolling:

1. What is it doing right now?
2. What is it waiting on from me?
3. What did it already do, and can I undo it?

A stranger with no context must be able to drive it. That is the whole brief.

---

## 1. Direction

**The counterfoil.**

Countersign is the second signature on a release order. The visual world is not "AI
dashboard" — it is the paperwork of authorised destruction: a munitions release form, a
bank counterfoil, a two-person authentication slip. Paper ground, ink text, hard rules,
one seal.

The interesting inversion: **the calm surface is the default, and danger is rationed.**
Most agent UIs are dark and alarming all the time, which means nothing reads as alarming.
Here, red appears **once**, on one element, at one moment: the irreversible commit. Until
the agent has measured the blast radius and proven the undo, there is no red on screen and
no Approve control at all.

Explicitly banned, because they are the generic AI-console default and judges will have
seen ten of them today: full-black backgrounds, neon cyan/violet/lime accents, glassmorphic
cards, glow shadows, particle fields, matrix rain, terminal-green-on-black, animated
gradient borders, floating orbs, typewriter text effects on anything except the receipt.

---

## 2. Tokens

### Color — 6 values, no others

```css
--bone:      #F2EFE6;  /* page ground — paper */
--ink:       #14120E;  /* primary text, hairline rules at 100% */
--graphite:  #6B675C;  /* secondary text, labels, inactive phase */
--rule:      #D8D2C2;  /* hairlines, table rules, card edges */
--seal:      #B3241C;  /* DESTRUCTIVE ONLY. see rationing rule below */
--proof:     #1F3A5F;  /* verified / undo-proven / receipt ink */
```

Dark mode: invert to `--ink` ground `#14120E`, `--bone` text, `--rule` at `#2E2A22`.
Same six roles, same rationing. Ship light as the default — every other submission will be
dark, and the video will read differently in the judging queue.

Three of the six cannot survive the inversion unchanged. On an `--ink` ground the light
`--graphite`, `--seal` and `--proof` measure **3.4:1, 2.9:1 and 1.7:1** — all under the
4.5:1 floor §8 calls non-negotiable. They are re-struck at the same role, lighter:

```css
@media (prefers-color-scheme: dark) {
  --graphite: #8B8578;  /* 5.2:1 on --ink */
  --seal:     #E4574C;  /* 5.2:1 on --ink */
  --proof:    #8FB6E0;  /* 9.0:1 on --ink */
}
```

Same six roles, same rationing, same meanings — only the values move, and only far enough
to clear the floor.

Every ratio, computed from the token values rather than estimated (WCAG 2.1, and re-derived
after an earlier figure in this document turned out to be wrong):

| | on `--bone` (light) | on `--ink` ground (dark) | on the WITNESSING tint |
| --- | --- | --- | --- |
| `--ink` / `--bone` text | **16.27:1** | **16.27:1** | 15.70:1 light · 15.88:1 dark |
| `--graphite` | **4.91:1** | **5.10:1** | 4.74:1 light · 4.98:1 dark |
| `--seal` | **5.73:1** | **5.14:1** | 5.53:1 light · 5.01:1 dark |
| `--proof` | **9.99:1** | **8.85:1** | 9.64:1 light · 8.64:1 dark |
| `--rule` | 1.31:1 | 1.31:1 | — |

Two consequences that are rules, not observations:

- **`--rule` is never text.** At 1.31:1 it fails the floor by a wide margin in both themes.
  §2 already gives it no text role — "hairlines, table rules, card edges" — and §5's
  instruction that future phase segments are `--rule` must be read as the *dot*, not the
  label. The label is `--graphite`, which §2 itself names as the inactive-phase colour.
- **Do not darken the WITNESSING tint past 2%.** `--graphite` on it measures 4.74:1; there
  is very little margin left before the floor.

The WITNESSING ground is `color-mix(in srgb, var(--proof) 2%, var(--bone))` — `#EEEBE3`
light, `#161512` dark — derived from the six, never a seventh value.

**Rationing rule for `--seal`:** at most one element on screen may be `--seal` at a time.
It belongs to the destructive row count *or* the countersign control — never both at once.
The total holds the red from the moment the ledger completes; when the countersign control
materialises, the total hands the red over and drops to `--ink`. Nothing else is ever
`--seal`. Not errors, not warnings, not the logo. If a second thing wants to be red, it
becomes `--graphite`.

`--proof` is the counterweight: it marks the three preconditions once they are satisfied,
and it is the ink the receipt is printed in.

### Type — 3 roles

| Role | Face | Use |
| --- | --- | --- |
| Display | **Bricolage Grotesque** (variable, `wdth` 75–100) | Row counts, phase name, the one big number. Used maybe six times on the page. |
| Body | **Inter Tight** | Prose, explanations, button labels. |
| Data | **IBM Plex Mono** | Every table name, column, primary key, SQL fragment, count, timestamp, fingerprint hash. |

All three are on Google Fonts. Load only the weights used: Bricolage 600/800, Inter Tight
400/500, Plex Mono 400/500. Bricolage's width axis runs **75–100** on Google Fonts, so the
widest face available is `wdth 100`; that is the display setting.

Rule: **anything that came out of the database is set in Plex Mono.** Anything the
interface says about it is Inter Tight. That distinction is the type system — the user can
tell at a glance what is real data and what is Countersign talking. The submitted SQL is
data for this purpose even though it was typed by the operator: it is the statement, not
Countersign's description of it.

Scale (1.25 ratio, no fractional px): 11 / 13 / 16 / 20 / 25 / 44 / 76.
`44` and `76` are Display-only. Body never goes above `20`.

### Space & shape

- 8px base grid. Gutters 24, section gaps 40.
- **Border radius: 2px everywhere.** Not 0 (that's the broadsheet default), not 12 (that's
  the SaaS default). 2px reads as a printed form.
- Rules are 1px `--rule`, except the rule under the phase header which is 2px `--ink`.
- No box shadows anywhere. Elevation is expressed with rules and ground shifts only.
- Max content width 1280. Below 900, the two columns stack (transcript collapses to a
  strip; the dossier keeps full width — the gate must never be below the fold).

---

## 3. Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COUNTERSIGN            ●INVESTIGATING ─ DECIDING ─ WITNESSING     db:▓ │  56px, rule 2px below
├──────────────────────────┬──────────────────────────────────────────────┤
│                          │                                              │
│  AGENT TRANSCRIPT        │   DOSSIER                                    │
│  (narrow, 380px, mono)   │   (fluid — content is phase-dependent)       │
│                          │                                              │
│  22:33:10  thinking      │   ┌────────────────────────────────────────┐ │
│    We need to run…       │   │  BLAST RADIUS            measured in   │ │
│                          │   │                          BEGIN…ROLLBACK│ │
│  22:33:10  run_investig… │   ├────────────────────────────────────────┤ │
│    → working  16.9s      │   │  users             6,000  ← root       │ │
│    ← 41 tables measured  │   │    ├ orders       17,971  CASCADE      │ │
│                          │   │    │  └ payments  19,442  CASCADE      │ │
│  22:33:27  commit_change │   │    └ 37 tables keep their rows,        │ │
│    → awaiting countersig │   │       4,172 references cleared    SET  │ │
│                          │   ├────────────────────────────────────────┤ │
│  ▌waiting on you         │   │           43,413  rows die             │ │
│                          │   └────────────────────────────────────────┘ │
│                          │                                              │
│                          │   ✓ BLAST RADIUS MEASURED                    │
│                          │   ✓ UNDO PROVEN  6,000/6,000 restored        │
│                          │   ✓ POLICY PASSED  4 rules, 0 blocking       │
│                          │                                              │
├──────────────────────────┴──────────────────────────────────────────────┤
│   fingerprint 3d2fde29…c22c7c8 · 6,000 root keys       [ COUNTERSIGN ]  │  gate bar, 88px
└─────────────────────────────────────────────────────────────────────────┘
```

**Left — transcript.** Mono, 13px, `--graphite` for timestamps, `--ink` for tool names.
Its job is *what is it doing*.

The unit is a **harness event, not an imagined tool call**. The real stream for a complete
run is two tool calls (`run_investigation`, then `commit_change`), each reaching the
console through TrueForge's `call_tool` meta-tool and unwrapped by the console. Do not
draw a finer-grained sequence than the harness emits. What the transcript renders, in
order of arrival:

- the model's `reasoningContent` as it streams, in `--graphite` — this is the only thing
  on screen during the first seconds of a turn, and it is real;
- the tool call, `--ink`, with its unwrapped name;
- while the call is open, an **elapsed counter** on that line. `run_investigation` took
  **16.9 seconds** in the recorded run and emits no events while it works. The counter is
  the honest answer to "is it stuck?", and it is the only motion permitted there;
- the result line on `tool.response`.

Timestamps come from each event's `createdAt`. Base events all carry one; **delta events
almost never do** (3 of 206 in the recorded run), so a line assembled from deltas is
timestamped by its parent event or not at all. Never synthesise a timestamp.

It scrolls; it never steals focus. Reserve the column width so streaming causes no layout
shift.

**Right — dossier.** The phase-adaptive panel. This is where the boldness is spent.

**Bottom — gate bar.** Persistent, fixed. Holds the fingerprint and the countersign
control. Never scrolls away.

---

## 4. The signature element

**The Approve control does not exist until it is earned.**

Not disabled. Not greyed out. **Absent.** The gate bar shows only the fingerprint and a
line of `--graphite` text naming what is still missing:

> `waiting: undo not yet proven`

The missing-line is a **blocked state, not a loading state.** In a healthy run the three
preconditions are satisfied together, in a single tool result, before TrueForge ever pauses
— so a healthy run never displays it. It appears when the gate is open and the evidence
behind it is not: undo unproven, policy failed, drift detected, or no simulation loaded for
the approval the harness is holding. It is the console repeating the engine's own refusal
codes, and it must name the specific missing item, never a generic "not ready".

When the preconditions are satisfied, each line stamps in — `--proof`, 120ms, no bounce,
staggered 60ms in the order blast radius → undo → policy — and the countersign control
**materialises** in the gate bar: a 200ms scale from 0.98 with the `--seal` fill arriving
80ms behind the shape, so the red is the last thing to appear on screen. The stagger is
presentation of a single arrival, not a claim that the proofs landed one at a time.

The control is **hold to countersign**, not click. Press and hold for 1200ms; a `--seal`
bar fills left to right across the button; release early and it resets. Two reasons, both
real: it makes an irreversible action require sustained intent rather than a stray click,
and it is the single most filmable second in a three-minute demo.

Label copy: `HOLD TO COUNTERSIGN` → during hold, `HOLD…` → on completion, `COUNTERSIGNED`.
The verb never changes across the flow.

**The undo is countersigned too.** Firing the undo is not a quiet local action: it sends an
order, the agent calls `fire_undo`, and TrueForge raises a second approval. The same gate
bar re-arms with the verb `RESTORE` — `HOLD TO RESTORE` → `HOLD…` → `RESTORED` — same
1200ms hold, same keyboard path. The only differences: the fill is `--proof`, not `--seal`,
because restoring is not destructive; and the freshness timer does not apply (see below).
Nothing about the undo is a single click, and the console must not imply otherwise.

Keyboard equivalent (required, not optional): focus the control and hold `Enter` for the
same duration, with the same fill. `prefers-reduced-motion` replaces the fill animation
with a stepped 4-segment progress; the hold duration stays.

### The other three things the gate bar must do

TrueForge holds the turn until the pending action is resolved. A gate bar that can only say
yes is a gate bar that can hang the run.

- **Deny.** Always present whenever a gate is open, as a `--graphite` text button beside the
  control — never styled to compete. It carries an optional reason back to the agent, and
  the console will not accept a new order while a gate is open (the harness returns a 422),
  so the deny reason is also the operator's only channel back to the agent at that moment.
  Say so in the placeholder: *reason, sent back to the agent*.
- **Stale.** The fingerprint is fresh for 120 seconds. An armed control can expire while the
  operator is still reading the ledger. See §5.
- **A question.** The agent can ask rather than act (`tool.response_required`, answered with
  `user.tool_response`). It occupies the gate bar the same way an approval does — the
  question in Inter Tight, a single-line answer field, and the same Deny escape. No hold:
  answering is not destructive.

**Waiting is not working.** An approval ends the turn (`turn.done`); countersigning starts a
new one. While the harness is paused on a gate, nothing is running — the header must show
`waiting on you`, never a running indicator. A spinner over a paused harness is the exact
lie this project exists to refuse.

---

## 5. The phases and screens

The phase indicator in the header is not decoration — it is the answer to *what is it
waiting on*. It is a three-segment track; the active segment is `--ink` with a filled dot,
past segments are `--graphite`, future segments are `--rule`. Before a change is submitted
all three are `--rule`.

### INVESTIGATING
Ground `--bone`. No red anywhere. The dossier shows the blast-radius ledger, indented by
foreign-key depth (depth is the number of edges in the row's `edge` path; the root row has
none), each row's count animating up from 0 over 240ms, staggered 60ms.

The ledger arrives **complete, in one tool result** — 41 tables in the recorded run — and
stamps in on arrival. The stagger is a reveal, not a live feed. Do not write copy claiming
rows are arriving as the shadow transaction reports them: the console cannot know that
today. (An engine progress channel would make it literally true — `simulateChange` already
emits per-table `onProgress` events that nothing consumes — but until that channel is
built, the spec does not describe one.)

**The ledger is 41 rows and the card does not scroll.** The rule:

- Rows that **die** (`delta > 0`) are always shown, indented by depth, with their edge
  semantics: `users 6,000 ← root`, `orders 17,971 CASCADE`, `payments 19,442 CASCADE`.
- Rows that are **touched but survive** (`delta = 0`, `affected > 0` — every `SET NULL`
  edge) collapse into one line: *37 tables keep their rows, 4,172 references cleared*,
  expandable to the full list. These are not deaths and must never be counted as such.
- The distinction between `delta` and `affected` is the product. A table losing its
  references is not a table losing its rows, and the console must never blur the two.

The total at the bottom is Display 76px and counts only `delta` — **43,413 rows die** in the
recorded run. It is the one moment red is allowed to arrive early: it turns `--seal` the
instant the ledger is complete, and hands the red to the countersign control when that
control materialises.

Empty state, before a change is submitted: a single Plex Mono input, full width, with the
placeholder `DELETE FROM users WHERE last_active < '2025-01-01'` and one line of Inter
Tight under it: *Paste a destructive statement. Nothing runs until you countersign.* That
placeholder is a statement that actually runs against the seeded estate — a stranger must
be able to copy it and get a real measurement. Never ship a placeholder naming a table or
column that does not exist.

### DECIDING
The three precondition lines and the gate.

`RESTRICT` edges that touch no rows get a `⚠` in `--graphite` and a one-line plain-English
note — *invoices are protected by a RESTRICT edge; none of them are in this blast path.*
Do not make this red. It is information, not alarm.

A `RESTRICT` edge that **does** touch rows is not a note. The policy engine's
`restrict_edges_block` rule fails on it, the verdict is `FAIL`, and the screen is REFUSED,
below. There is no screen on which a live RESTRICT edge and a passing policy coexist.

Precondition copy names what was measured: `BLAST RADIUS MEASURED`, `UNDO PROVEN
6,000/6,000 restored`, `POLICY PASSED 4 rules, 0 blocking`. Four, not three — the engine
evaluates `max_rows_deleted`, `protected_tables`, `require_verified_undo` and
`restrict_edges_block`.

### REFUSED
A gate is open and the evidence does not support it. Ground stays `--bone`; **no red** —
nothing destructive is being offered, so nothing earns the seal. The countersign control is
absent, as always. In its place, the gate bar carries the missing-line, and the dossier
carries the reason in full:

- **Undo not proven.** *Undo could not be proven — 12 of 6,000 rows did not restore in
  shadow. Countersign is unavailable.* Then what to do next: *deny this gate and resubmit;
  the agent will re-measure.*
- **Policy failed.** The failing rule, by name, with the engine's own detail string:
  *`restrict_edges_block` — RESTRICT edges would abort the real run: invoices.*
- **Drift.** *The measured rows changed after they were counted. This approval is void.*
- **No evidence loaded.** The harness is holding an approval whose simulation this console
  has never seen — after a reload, or against a restarted engine. Say exactly that.

The failing precondition line is `--graphite` with a `✕`, never `--seal`. Deny is the
primary control on this screen and it is the only one.

### STALE
The gate was armed and the fingerprint aged past 120 seconds while the operator was
reading. This is the most on-thesis screen in the product and it must not be a toast.

The countersign control **withdraws** — the same 200ms scale, reversed, the `--seal` fill
leaving 80ms ahead of the shape, so the red is the first thing to go. The gate bar then
reads, in `--graphite`: *these rows were counted 2m 14s ago. The count is no longer
current.* And the action: *deny this gate, then send the order again for a fresh
measurement.*

The ledger stays on screen, dimmed to `--graphite`, with the total dropped from `--seal` to
`--ink`. Nothing is deleted from view — the operator should be able to see exactly what
expired. A countdown is shown in the gate bar from 30 seconds remaining, Plex Mono,
`--graphite`, so expiry is never a surprise.

The `RESTORE` gate has no freshness timer and never reaches this screen: an undo is gated by
committed state and its one-shot token, not by a pre-commit measurement.

### WITNESSING
Ground shifts to a 2% `--proof` tint. The receipt prints — this is the **one** place a
typewriter effect is permitted, ~18ms per line, because a receipt printing is the literal
metaphor. It shows: rows affected per table, the fingerprint, the keys the commit was
scoped to versus the root rows actually deleted, the commit timestamp, and a persistent
`UNDO ARMED · verified` chip in `--proof`.

No GitHub PR link. The engine's `/state` carries no PR reference and nothing writes one, so
the receipt cannot show one without inventing it. If a PR field is added to the engine
later, it belongs here; until then it is not on the screen.

The undo control sits beside it, styled as a plain `--ink` outline button — deliberately
undramatic, because the whole thesis is that the undo is boring and certain. Pressing it
does not fire the undo: it sends the order, and the gate bar re-arms with `HOLD TO RESTORE`
(§4). The button's label is `Fire the verified undo`, and the line under it says what will
happen: *sends the order; you will countersign the restore.*

---

## 6. Motion budget

Total animated elements on the page: **five**. If you add a sixth, remove one.

1. Transcript lines appearing — 100ms fade, no translate.
2. Ledger rows filling — 240ms count-up, staggered 60ms.
3. Precondition lines stamping — 120ms, opacity + 2px rise.
4. Countersign control materialising — 200ms scale, 80ms delayed fill. The STALE withdrawal
   is this same animation reversed; it does not count as a sixth.
5. Receipt printing — 18ms/line.

The transcript's elapsed counter is a number changing, not an animation, and is exempt.

Everything else: `transition: 140ms ease-out` on color and border only. No transform on
hover. No entrance animations on page load. No scroll-triggered anything.

`@media (prefers-reduced-motion: reduce)` — all five become instant state changes except
the hold-to-countersign fill, which becomes stepped.

---

## 7. Copy rules

- Sentence case in prose, ALL CAPS with `0.08em` tracking for the six structural labels
  only (`BLAST RADIUS`, `UNDO PROVEN`, phase names, etc.).
- Name things by what the user controls: *rows die*, not *cascade delete propagation
  count*. *Waiting on you*, not *Pending human-in-the-loop approval*.
- The failure state is directional, never apologetic: *Undo could not be proven — 12 of
  6,000 rows did not restore in shadow. Countersign is unavailable.* Then: what to do next.
- Never use the word "safely." Show the number instead.
- Never describe an arrival the console did not witness. If the data came in one lump, the
  copy does not say it trickled.

---

## 8. Quality floor (non-negotiable — judges run it)

- Responsive to 390px. On mobile the gate bar stays fixed to the bottom.
- Visible keyboard focus ring: 2px `--ink` offset 2px. Never `outline: none`.
- Full keyboard path: input → submit → countersign hold → deny → undo → restore hold.
- Contrast: all text ≥ 4.5:1 on its ground — measured, not assumed; the table in §2 carries every ratio. `--graphite` on `--bone` is 4.91:1, so do not lighten it, and `--rule` is never text at 1.31:1.
- The console must render a sane empty state with no agent connected, so a judge cloning
  the repo sees something rather than a blank page.
- No layout shift when the transcript streams — reserve the column width.
- No custom cursor. The native pointer is the one the operator trusts.

---

## 9. Corrections against the running system

This spec was checked against the recorded run and the engine source before any component
was written. Ten places where the original draft described something the system does not
do, and what was decided:

| # | The draft said | The system does | Decision |
| --- | --- | --- | --- |
| A1 | Transcript of fine-grained tool calls (`introspect_schema`, `shadow DELETE`, `prove_undo`) | Two tool calls for the whole run, both via `call_tool` | §3 — transcript renders harness events: reasoning, call, elapsed, result |
| A2 | Ledger fills row by row as the shadow transaction reports | 41 rows arrive in one `tool.response` after 16.9s | §5 — stamps in on arrival, staggered; copy claim removed |
| A3 | Preconditions stamp in one at a time | All three flip in that same result, 0.79s before the gate | §4 — missing-line is the blocked state, not a loading state |
| A4 | `RESTRICT ⚠` shown alongside `POLICY PASSED`, 3 rules | A live RESTRICT edge fails `restrict_edges_block`; 4 rules | §5 — live RESTRICT is REFUSED; ⚠ note is for zero-affected edges |
| A5 | A four-row ledger | 41 tables: 3 die, 37 lose references only, 1 untouched | §5 — deaths always shown, SET NULL edges collapse to one line |
| A6 | Placeholder `DELETE FROM accounts WHERE last_login…` | No `accounts` table, no `last_login` column | §5 — placeholder is a statement that actually runs |
| A7 | Only an Approve control | Deny, staleness and questions all exist and all block the turn | §4 — all three given a home in the gate bar; §5 STALE screen |
| A8 | Undo as a plain button | Firing the undo raises a second TrueForge approval | §4 — `RESTORE` verb, same hold, `--proof` fill |
| A9 | Receipt shows a GitHub PR link | `/state` carries no PR reference | §5 — cut until the engine provides one |
| A10 | `--seal` on both the total and the control | Both are on screen together in DECIDING | §2 — the total hands the red to the control |

Two of these — A2 and A3 — could be made literally true by exposing the engine's existing
`onProgress` stages over a progress channel. That is a real feature, not a workaround, and
if it is built this spec should be revised to describe it. Until then the spec describes
what the console can actually observe.
