# DESIGN-5.3 — the section

A third direction, drafted for comparison against v5.1 (one world) and v5.2 (the dark stage
that ships today). Nothing in `console/src` implements this yet. `DESIGN.md` remains the
counterfoil spec; this document does not replace it.

---

## 0. Why a third direction at all

v5.1 and v5.2 are the same family: a dark ground with the 3D world behind the console and
colour spent on numerals. The counterfoil in `DESIGN.md` is the opposite pole: paper, hard
rules, one seal. Both are *surfaces* — they decide what the console is made of.

Neither decides **what the ledger actually is**. In both, the blast radius is a table of rows
with a big number underneath. This direction starts from the opposite end: it fixes the
central object first, and lets the surface follow from it.

The object: **a section.** You do not delete a row; you remove a member from a structure and
the load path fails through everything resting on it. That is exactly what a foreign-key
cascade is, and a section is the drawing an engineer makes *before* cutting.

---

## 1. Direction

**The section.**

Drafting film, graphite line work, one red overprint on the cut line. The vernacular is the
engineering sectional elevation: a grade line, strata beneath it, hatching for disturbed
material, a title block, a scale bar, dimension callouts.

The thesis this serves: Countersign's claim is *measured, not estimated*. A section is the
artifact of measurement — you cannot draw one without having surveyed the thing. A table of
row counts asserts a measurement; a section **shows its shape**.

**The risk, and why it is worth taking.** The ground is a mid-grey-green, `#DCDFD6` — neither
the warm cream nor the near-black that most consoles land on. A mid-value ground is harder to
work with: it gives less headroom in both directions and unconfident designs go muddy on it.
It is chosen because it is the actual material of the subject's world (drafting film is
grey-green precisely so graphite and red overprint both read on it), and because it is the
one ground on which the red overprint looks like *ink on a drawing* rather than an alert.

**Not this.** No cream-and-serif-and-terracotta. No near-black with one acid accent — that is
v5.2 and half the field. No hairline broadsheet columns — that is the counterfoil. If a
choice here could be dropped unchanged into another product, it is the wrong choice.

---

## 2. Tokens

### Colour — six values, measured

```css
--film:     #DCDFD6;  /* ground — drafting film */
--graphite: #1B1D1A;  /* line work, primary text        12.58:1 */
--pencil:   #565B52;  /* secondary text, labels          5.17:1 */
--tick:     #A9AEA3;  /* grid, hatching, hairlines — NEVER text   1.68:1 */
--cut:      #A62A1B;  /* destructive only                5.24:1 */
--blue:     #27467F;  /* verified, proven, drafting blue 6.86:1 */
```

Dark inversion, on `#16181A`: graphite → `#DCDFD6` (13.20:1), pencil → `#9BA095` (6.66:1),
cut → `#FF7A63` (6.96:1), blue → `#8FB0F0` (8.17:1), tick → `#33372F`.

Every ratio computed from the values, not estimated. `--tick` is structure and never carries
text, exactly as `--rule` does not in `DESIGN.md`.

**Rationing.** `--cut` belongs to the cut line and the countersign control, and they are the
same object — the control sits *on* the line. Nothing else is ever red. Not errors, not
warnings, not the refused screen.

### Type — three roles

| Role | Face | Why this one |
| --- | --- | --- |
| Display | **Archivo** (variable, `wdth` 62–125) | A title-block face. Set expanded for the drawing's own labels, condensed for stratum names where the column is narrow — the width axis does real work rather than decorating. |
| Body | **Public Sans** | Plainspoken and utilitarian, drawn for public-service interfaces. It reads as instruction, not as marketing. |
| Data | **DM Mono** | Narrower and less rounded than Plex Mono; sits closer to a drafting stencil. |

Same discipline as the counterfoil: **anything that came out of the database is DM Mono.**
Anything the interface says about it is Public Sans. Archivo is for the drawing's own
apparatus — the title block, the stratum labels, the one big figure.

Scale: 11 / 13 / 16 / 20 / 26 / 40 / 88. The 88 is the depth figure and appears once.

### Space & shape

- 8px grid. The drawing area is ruled at 24px with `--tick` at 20% — a drafting grid you can
  see only when you look for it.
- **Radius 0.** Not a style choice: a section drawing has no rounded corners.
- Lines are 1px `--tick`, 1.5px `--graphite` for a member's edge, 2px `--cut` for the cut line.
- No shadows. Depth is expressed by stratum order and hatch density.

---

## 3. Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ COUNTERSIGN            SECTION A–A          SIM 46cfc815    SCALE 1:log  │  title block
├──────────────────────┬───────────────────────────────────────────────────┤
│                      │                                                   │
│ FIELD LOG            │   ── grade ─────────────────────────────────────  │
│ (what the agent      │   users                             6,000  ← named│
│  is doing)           │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                  │
│                      │                                                   │
│ 22:33:10 reasoning   │   ── depth 1 ──────────────────────────────────    │
│   we need to run…    │   orders                           17,971  CASCADE│
│                      │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                        │
│ 22:33:10 run_inves…  │                                                   │
│   working     16.9s  │   ── depth 2 ──────────────────────────────────    │
│   ← 41 tables        │   payments                         19,442  CASCADE│
│                      │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │
│ 22:33:27 commit_ch…  │                                                   │
│   → waiting on you   │   ╱╱╱ 37 tables keep their rows, 3,542 refs cleared│
│                      │   ─── invoices · RESTRICT · nothing in this path ──│
│                      │                                                   │
│                      │              88px    43,413  ROWS DIE             │
├──────────────────────┴───────────────────────────────────────────────────┤
│ ══════════════════ CUT LINE ═════════════  fp 46cfc815  [ HOLD TO CUT ]  │  the cut line
└──────────────────────────────────────────────────────────────────────────┘
```

**Left — field log.** The transcript, renamed to what it is on a drawing. Same content and
same honesty rules as `DESIGN.md` §3: harness events only, real `createdAt`, an elapsed
counter on an open call, reasoning surfaced.

**Right — the section.** Strata in measured order: the named table at grade, then each
foreign-key depth beneath it. A stratum's **bar length is log-scaled** to its row count, so
6,000 and 19,442 both read without the small one vanishing; the figure is always printed, so
the scale never has to be trusted.

- **Solid fill** = rows removed. The material is gone.
- **Hatching** (`╱╱╱`, `--tick`) = rows disturbed but present. Every SET NULL edge, collapsed
  to one hatched band. Hatching is the drafting convention for material that is cut through
  but remains — which is precisely what a nulled foreign key is.
- **A boundary line, no fill** = a RESTRICT edge. It bounds the excavation; nothing is taken.

That is the whole delta/affected distinction, carried by drawing convention instead of by a
column header. A reader who knows sections reads it without a legend.

**Bottom — the cut line.** Persistent, fixed. Carries the fingerprint and the control.

---

## 4. The signature: the control is on the cut line

In the counterfoil the signature is that the Approve control does not exist until earned.
That rule holds here and is not restated — but the *form* changes.

The cut line is drawn across the full width of the drawing, beneath the deepest stratum, in
2px `--cut`. **It appears only when the section is complete**, and the countersign control is
not a button placed near it: the control is a segment of the line itself. Holding it draws
the cut — the fill sweeps left to right along the line, and the strata above it are what the
cut takes.

`HOLD TO CUT` → during the hold `CUTTING…` → `CUT`. 1200ms, keyboard parity on `Enter`,
stepped under `prefers-reduced-motion`. The verb is consistent with the drawing rather than
with the software: you are not approving a request, you are making the cut you have been
shown.

When the measurement expires, the cut line **lifts off the drawing** — 200ms, the red leaving
first — and what remains is a section with no cut in it. That is a truer picture of a stale
gate than a greyed button: the drawing is still valid, the cut is not.

For the undo, the line returns in `--blue` and reads `HOLD TO BACKFILL`. Restoring is not
destructive, so it is never red, and backfill is what you do to an excavation.

---

## 5. The six states

**Empty.** The title block, an empty drawing area ruled with its grid, and one input on the
grade line: *the change*. The placeholder is the statement that actually runs. No cut line —
nothing has been surveyed.

**Investigating.** Strata ink in top-down, in the order the engine measures them: grade, then
each depth. Bars draw left to right over 240ms, staggered 60ms. The depth figure counts up
last. No red anywhere yet.

**Deciding.** The section is complete; the cut line inks in; the control becomes a segment of
it. Preconditions are printed as a **revision block** in `--blue`, bottom-right of the drawing
where a title block's revisions go, each with its measurement:

```
A  BLAST RADIUS MEASURED        41 tables
B  UNDO PROVEN                  6,000/6,000 restored
C  POLICY PASSED                4 rules, 0 blocking
```

**Witnessing.** The cut is drawn. Strata above it are re-hatched as removed; the receipt is
printed as the drawing's own notes column. `BACKFILL AVAILABLE` in `--blue`.

**Refused.** No cut line is drawn at all, because there is nothing to cut. The failing
revision letter is struck through and annotated with the engine's own words. **No red** — a
refusal is not a danger, it is an absent cut.

**Stale.** The cut line lifts. The section stays. The countdown prints in the title block as a
validity note, which is where a drawing's expiry belongs.

---

## 6. Motion

Four, and the budget is a maximum rather than a target.

1. Strata drawing in — 240ms per bar, staggered 60ms, top-down by depth.
2. The depth figure counting up — 240ms, after the last stratum.
3. The cut line inking in — 200ms, red arriving 80ms behind the line. Reversed on expiry.
4. The hold fill travelling the line — 1200ms, stepped under reduced motion.

The field log's elapsed counter is a number changing, not an animation.

---

## 7. Quality floor

Unchanged from `DESIGN.md` §8, and not restated here except where this direction adds a
constraint:

- Responsive to 390px. The section stacks below the field log; the cut line stays fixed.
- The hatched band and the solid fill must be **distinguishable without colour** — they are
  fill patterns, not hues, which is the point of using drafting convention.
- Every figure is printed next to its bar. The log scale is a reading aid and never the only
  source of a number.
- `--tick` is never text. `--cut` never appears on a refused screen.

---

## 8. What this costs

Honest accounting, since this is a comparison document:

- **It is more drawing than the other two.** Log-scaled bars, hatching, a revision block and a
  cut line are more to build and more to get wrong than a table with a total.
- **The 88px depth figure competes with the section itself.** If both are loud the drawing
  reads as two things. The figure may need to drop to 40 and live in the title block.
- **Sections imply spatial truth.** Depth here is foreign-key depth, not anything physical.
  The grade/depth labels must say so, or the drawing overclaims.
- **A mid-grey ground photographs differently** than paper or black, and the demo is judged on
  video. Worth a test frame before committing.
