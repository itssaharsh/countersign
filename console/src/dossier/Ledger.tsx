// DESIGN.md §5 INVESTIGATING — the blast-radius ledger.
//
// The one thing this component exists to protect: `delta` and `affected` are not
// the same number and must never be blurred. A table whose foreign keys are
// nulled keeps every row it had. In the recorded run 3 tables lose 43,413 rows
// and 37 tables lose 4,172 references while losing nothing — a console that adds
// those together is lying about the consequence, which is the exact failure this
// project exists to refuse. So: deaths are always visible and indented by
// foreign-key depth; the SET NULL edges collapse into one line that says what
// they actually are; and the 76px total counts `delta` only.
//
// Every number here is computed from /state through the helpers in state.ts.
// Nothing is hardcoded — the copy reads "37 tables … 4,172 references" against
// the recorded fixture because that is what the fixture measured.
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { Simulation, TableRow } from '../state'
import { depthOf, dyingTables, referencesCleared, rowsThatDie, touchedTables } from '../state'

/** Deterministic grouping, so the ledger reads the same for every operator. */
const fmt = (n: number) => n.toLocaleString('en-US')

// §6 item 2 — 240ms count-up, staggered 60ms per row. The only motion in here.
const COUNT_MS = 240
const STAGGER_MS = 60

/**
 * Count up to `target` after `delay`. §6: under prefers-reduced-motion this is
 * an instant state change — not a shorter animation, and not a delayed one.
 * Returns the value to show and whether it has landed.
 */
function useCountUp(target: number, delay: number): [number, boolean] {
  const reduced = Boolean(useReducedMotion())
  // Reset during render when the measurement changes, not in an effect: an effect
  // runs after paint, so the first frame would still show the previous run's count.
  const [run, setRun] = useState({ target, n: 0, done: false })
  if (run.target !== target) setRun({ target, n: 0, done: false })

  useEffect(() => {
    if (reduced) return
    let raf = 0
    let t0 = 0
    const step = (t: number) => {
      if (!t0) t0 = t
      const e = t - t0 - delay
      if (e < 0) { raf = requestAnimationFrame(step); return }
      const p = Math.min(1, e / COUNT_MS)
      setRun({ target, n: Math.round(target * p), done: p >= 1 })
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, reduced])

  // §6 — under reduce the count-up is not shortened, it does not happen: the
  // measured number is simply what is on screen from the first paint.
  return reduced ? [target, true] : [run.n, run.done]
}

/** CASCADE / SET NULL / RESTRICT, or the root of the change, which has no edge. */
function edgeLabel(t: TableRow): string {
  return t.edge ? (t.onDelete ?? 'NO ACTION') : '← root'
}

function DyingRow({ t, slot }: { t: TableRow; slot: number }) {
  const depth = depthOf(t)
  const [shown] = useCountUp(t.delta, slot * STAGGER_MS)
  return (
    <tr className="ledger-row" data-rowkind="dies" data-name={t.name} data-depth={depth} data-delta={t.delta}>
      <th scope="row" className="ledger-name t-data" style={{ paddingLeft: depth * 20 }}>
        {depth > 0 && <span className="ledger-branch" aria-hidden>└</span>}
        {t.name}
      </th>
      <td className="ledger-count t-data">{fmt(shown)}</td>
      <td className="ledger-edge t-data" title={t.edge ?? undefined}>{edgeLabel(t)}</td>
    </tr>
  )
}

export function Ledger({ sim }: { sim: Simulation }) {
  const [open, setOpen] = useState(false)

  const dying = dyingTables(sim)
  const touched = touchedTables(sim)
  const cleared = referencesCleared(sim)
  const total = rowsThatDie(sim)

  // §5 — a RESTRICT edge with nothing in the blast path is a note, not an alarm.
  // A RESTRICT edge that *does* touch rows fails policy.mjs's restrict_edges_block,
  // the verdict is FAIL and the screen is REFUSED. There is no screen where a live
  // RESTRICT edge and a passing policy coexist, so this component does not draw one.
  const restrictNotes = sim.tables.filter((t) => t.onDelete === 'RESTRICT' && (t.affected ?? 0) === 0)

  // Stagger slots, in the order the lines are painted: the deaths, then the one
  // collapsed SET NULL line, then each RESTRICT note. The total lands after all
  // of them, so the big number is the last thing that finishes moving.
  const groupSlot = dying.length
  const noteSlot0 = groupSlot + (touched.length ? 1 : 0)
  const totalSlot = noteSlot0 + restrictNotes.length

  const [clearedShown] = useCountUp(cleared, groupSlot * STAGGER_MS)
  const [totalShown, landed] = useCountUp(total, totalSlot * STAGGER_MS)

  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <header className="ledger-head">
        <h2 className="t-label" id="ledger-h">Blast radius</h2>
        {/* §7 — ALL CAPS is for the structural labels only. This is prose about a
            SQL fragment, so it is sentence case, and the fragment is Plex Mono. */}
        <span className="ledger-how">measured in <span className="t-data">BEGIN…ROLLBACK</span></span>
      </header>

      <table className="ledger-table">
        <caption className="vh">
          {fmt(sim.tables.length)} tables measured. Rows that die are listed by foreign-key depth;
          tables that keep their rows are summarised on one line.
        </caption>
        <tbody>
          {dying.map((t, i) => <DyingRow key={t.name} t={t} slot={i} />)}

          {touched.length > 0 && (
            <tr className="ledger-row is-group" data-rowkind="group" data-tables={touched.length} data-cleared={cleared}>
              <td className="ledger-group" colSpan={2}>
                <button
                  type="button"
                  className="ledger-toggle"
                  aria-expanded={open}
                  aria-controls="ledger-kept"
                  onClick={() => setOpen((v) => !v)}
                >
                  <span className="t-data">{fmt(touched.length)}</span> tables keep their rows,{' '}
                  <span className="t-data">{fmt(clearedShown)}</span> references cleared
                  <span className="ledger-chevron" aria-hidden>{open ? '−' : '+'}</span>
                </button>
              </td>
              <td className="ledger-edge t-data">SET NULL</td>
            </tr>
          )}

          {touched.length > 0 && open && (
            <tr className="ledger-sub-row" id="ledger-kept">
              <td colSpan={3}>
                <ul className="ledger-sub">
                  {touched.map((t) => (
                    <li key={t.name} data-rowkind="cleared" data-name={t.name} data-delta={0} data-affected={t.affected ?? 0}>
                      <span
                        className="ledger-name t-data"
                        style={{ paddingLeft: depthOf(t) * 20 }}
                        title={t.edge ?? undefined}
                      >
                        {t.name}
                      </span>
                      {/* Never a bare number in the death column: what this table lost
                          is references, and the line says so in words. */}
                      <span className="ledger-kept-n t-data">{fmt(t.affected ?? 0)} references cleared</span>
                      <span className="ledger-edge t-data">{edgeLabel(t)}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          )}

          {restrictNotes.map((t) => (
            <tr className="ledger-row is-note" key={t.name} data-rowkind="note" data-name={t.name}>
              <td className="ledger-note" colSpan={2}>
                <span className="ledger-warn" aria-hidden>⚠</span>
                {t.name} is protected by a RESTRICT edge; none of its rows are in this blast path.
              </td>
              <td className="ledger-edge t-data" title={t.edge ?? undefined}>RESTRICT</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* §2 rationing — the total holds the red from the moment the ledger is
          complete, and hands it to the countersign control when that control
          exists. The handoff is in index.css: `.console:has(.gate-bar .hold)`
          drops this back to --ink, so the two can never be red at once. */}
      <div className={`ledger-total ${landed ? 'is-sealed' : ''}`}>
        <span className="ledger-total-n t-display" data-total={total}>{fmt(totalShown)}</span>
        <span className="ledger-total-l t-label">rows die</span>
      </div>
    </section>
  )
}
