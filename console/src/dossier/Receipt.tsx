// WITNESSING: the receipt.
//
// The ground shifts to a 2% --proof tint and the receipt prints, ~18ms a line.
// This is the ONE place a typewriter effect is permitted in the whole design
// (§6 item 5, and §1's ban list names it as the single exception) because a
// receipt printing is the literal metaphor, not decoration. Instant under
// prefers-reduced-motion.
//
// What it shows, and nothing else: rows affected per table, the fingerprint,
// the keys the commit was scoped to versus the root rows actually deleted, the
// commit timestamp, and a persistent `UNDO ARMED · verified` chip in --proof.
//
// No GitHub PR link — correction A9. The engine's /state carries no PR
// reference and nothing writes one, so the receipt cannot show one without
// inventing it. Every figure below is read off the simulation the console
// received; nothing here is computed to fill a gap.
//
// The undo control is a plain --ink outline button, deliberately undramatic,
// because the thesis is that the undo is boring and certain. Pressing it does
// not fire the undo (A8): it sends an order, the agent calls fire_undo, and
// TrueForge raises a second approval that the gate bar re-arms for with
// HOLD TO RESTORE.
import { useEffect, useMemo, useState } from 'react'
import type { Simulation, TableRow } from '../state'
import { dyingTables, referencesCleared, rowsThatDie, touchedTables } from '../state'

/** §6 item 5 — the printer's line rate. */
const LINE_MS = 18

/** The order the undo control sends. The agent turns it into a fire_undo call. */
const UNDO_ORDER = 'Fire the verified undo for this committed change.'

type Row =
  | { k: 'head'; id: string; text: string }
  | { k: 'sql'; id: string; text: string }
  | { k: 'text'; id: string; text: string }
  | { k: 'line'; id: string; name: string; fig: string; note?: string; title?: string; fact?: string; table?: string }
  | { k: 'total'; id: string; name: string; fig: string }
  | { k: 'group'; id: string; label: string; tables: TableRow[] }

/**
 * An ISO instant as the operator reads it, in the zone the engine recorded it
 * in. Never reformatted into local time: the receipt is a record of when the
 * commit happened, and a timestamp that moves with the reader's laptop is not
 * a record.
 */
function utc(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`
}

const n = (x: number) => x.toLocaleString()

/** The edge semantics for a measured table, in the engine's own words. */
function edgeNote(t: TableRow): string {
  return t.edge ? (t.onDelete ?? '') : 'root'
}

function buildRows(sim: Simulation): Row[] {
  const rows: Row[] = []
  const dying = dyingTables(sim)
  const touched = touchedTables(sim)
  // Measured, in the blast path, and losing nothing: the RESTRICT edge that
  // touches no rows (§5 DECIDING). It is information, not alarm, and on the
  // receipt it is the proof that it stayed at zero.
  const untouched = sim.tables.filter((t) => !(t.delta ?? 0) && !(t.affected ?? 0))

  const committedAt = utc(sim.committed_at)
  rows.push({ k: 'head', id: 'h-committed', text: 'Committed' })
  if (committedAt) rows.push({ k: 'line', id: 'committed_at', name: 'committed at', fig: committedAt, fact: 'committed_at' })
  rows.push({ k: 'sql', id: 'sql', text: sim.change_sql })

  rows.push({ k: 'head', id: 'h-deleted', text: 'Rows deleted per table' })
  for (const t of dying) {
    rows.push({ k: 'line', id: `d-${t.name}`, name: t.name, fig: n(t.delta), note: edgeNote(t), table: t.name })
  }
  rows.push({ k: 'total', id: 'total-died', name: 'rows died', fig: n(rowsThatDie(sim)) })

  if (touched.length) {
    // The same rule the ledger follows (§5): tables that lose references but keep
    // their rows collapse to one line. Printed out in full they were 37 identical
    // SET NULL rows between the death count and the fingerprint — the two figures
    // the receipt exists to show — and the screen ran past three viewports. The
    // list is one click away, so the record is intact; it is no longer the bulk
    // of the record.
    rows.push({ k: 'head', id: 'h-cleared', text: 'References cleared' })
    rows.push({ k: 'group', id: 'cleared-group', label: `${n(touched.length)} tables kept every row they had`, tables: touched })
    rows.push({ k: 'total', id: 'total-cleared', name: 'references cleared', fig: n(referencesCleared(sim)) })
    rows.push({ k: 'text', id: 'cleared-note', text: 'A cleared reference is not a death and is never counted as one.' })
  }

  if (untouched.length) {
    rows.push({ k: 'head', id: 'h-untouched', text: 'Measured, untouched' })
    for (const t of untouched) {
      rows.push({ k: 'line', id: `u-${t.name}`, name: t.name, fig: '0', note: edgeNote(t), table: t.name })
    }
  }

  // The crux of the screen: what the commit was allowed to touch, and what it
  // actually deleted. Two figures from the engine, never merged into one.
  if (sim.execution) {
    rows.push({ k: 'head', id: 'h-scope', text: 'Scope of the commit' })
    rows.push({
      k: 'line', id: 'scoped_to_pks', fact: 'scoped_to_pks',
      name: 'keys the commit was scoped to', fig: n(sim.execution.scoped_to_pks), note: 'keys',
    })
    rows.push({
      k: 'line', id: 'deleted_root_rows', fact: 'deleted_root_rows',
      name: 'root rows actually deleted', fig: n(sim.execution.deleted_root_rows), note: 'rows',
    })
    rows.push({ k: 'text', id: 'scope-note', text: 'Two measurements, not one: the key set the statement was bounded to, and the root rows the run removed.' })
  }

  const fp = sim.fingerprint
  if (fp) {
    rows.push({ k: 'head', id: 'h-fingerprint', text: 'Fingerprint' })
    rows.push({
      k: 'line', id: 'pk_hash', fact: 'pk_hash', name: 'pk hash', title: fp.pk_hash,
      fig: `${fp.pk_hash.slice(0, 8)}…${fp.pk_hash.slice(-7)}`,
    })
    rows.push({ k: 'line', id: 'pk_column', name: 'pk column', fig: fp.pk_column })
    rows.push({ k: 'line', id: 'fp_count', name: 'keys fingerprinted', fig: n(fp.count) })
    const measured = utc(fp.measured_at)
    if (measured) rows.push({ k: 'line', id: 'measured_at', name: 'measured at', fig: measured })
  }

  rows.push({ k: 'head', id: 'h-undo', text: 'Undo' })
  const report = (sim.undo.report ?? {}) as { restored_rows?: unknown }
  const restored = typeof report.restored_rows === 'number' ? report.restored_rows : null
  if (restored !== null) {
    rows.push({
      k: 'line', id: 'restored_rows', fact: 'restored_rows', name: 'rows restored in shadow',
      fig: fp ? `${n(restored)} / ${n(fp.count)}` : n(restored),
    })
  }
  rows.push({ k: 'line', id: 'undo_statements', name: 'rollback statements', fig: n(sim.undo.statements) })
  const verifiedAt = utc(sim.undo.verified_at)
  if (verifiedAt) rows.push({ k: 'line', id: 'verified_at', name: 'verified at', fig: verifiedAt })

  rows.push({ k: 'text', id: 'measured-note', text: `${n(sim.tables.length)} tables measured in the shadow transaction.` })
  return rows
}

/**
 * The collapsed SET NULL block. A button, because it expands to the full list —
 * the same control the ledger gives the same fact, so an operator who opened it
 * on the forecast finds it in the same place on the record.
 */
function ClearedGroup({ id, label, tables }: { id: string; label: string; tables: TableRow[] }) {
  const [open, setOpen] = useState(false)
  const listId = `${id}-list`
  return (
    <div className="receipt-group" data-tables={tables.length}>
      <button type="button" className="receipt-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        <span className="t-data">{label}</span>
        <span className="receipt-chevron" aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="receipt-sub" id={listId}>
          {tables.map((t) => (
            <li key={t.name} data-name={t.name} data-affected={t.affected ?? 0}>
              <span className="r-name t-data">{t.name}</span>
              <span className="r-val">
                <span className="r-fig t-data">{n(t.affected ?? 0)}</span>
                <span className="r-note t-data">{edgeNote(t)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Receipt({ sim, onSend, approvalOpen, running, demo = false }: {
  sim: Simulation
  onSend: (text: string) => void
  /** A replay has no harness behind it, so the undo cannot be ordered from here. */
  demo?: boolean
  // Only an approval concerns the restore. A pending question is a different
  // state and must not be presented as "the restore gate is open below".
  approvalOpen: boolean
  running: boolean
}) {
  // The undo is one shot. Once the engine has fired it, further attempts are
  // refused — so the console must stop describing it as armed and stop offering
  // a control that cannot work.
  const spent = sim.undo.fired === true
  const rows = useMemo(() => buildRows(sim), [sim])
  // /state is polled, so `sim` is a fresh object every 1.5s even when nothing
  // changed. The printer keys off what the receipt actually says, not off
  // object identity — otherwise the poll would restart the print on every tick.
  const sig = `${sim.simulation_id}|${sim.committed_at ?? ''}|${rows.length}`

  // §5 — the ground shifts to a 2% --proof tint while the receipt is on screen.
  // Set on the root so the fixed gate bar shifts with it; the console is one
  // sheet of paper, not a panel floating on a different one.
  useEffect(() => {
    document.documentElement.setAttribute('data-ground', 'proof')
    return () => document.documentElement.removeAttribute('data-ground')
  }, [])

  // The printer. One line every 18ms; instant when motion is reduced, because
  // §6 makes all five budgeted animations instant there.
  const [printed, setPrinted] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const total = rows.length
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setPrinted(total); return }
    setPrinted(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setPrinted(i)
      if (i >= total) clearInterval(t)
    }, LINE_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const done = printed >= rows.length

  return (
    <div className="receipt" data-printing={done ? 'false' : 'true'} data-lines={rows.length}>
      <div className="receipt-head">
        <h2 className="t-label">Receipt</h2>
        {/* Persistent, never printed away: the undo is armed for as long as this
            screen is up, and the operator should never have to wait for a line
            to arrive to learn that. */}
        <span className={`receipt-chip t-data${spent ? ' is-spent' : ''}`}>
          <span className="chip-label">{spent ? 'Undo fired' : 'Undo armed'}</span>
          <span className="chip-value">· {spent ? 'rows restored' : 'verified'}</span>
        </span>
      </div>

      <div className="receipt-body" aria-busy={done ? undefined : true}>
        {rows.slice(0, printed).map((r) => {
          if (r.k === 'head') return <p key={r.id} className="t-label receipt-section">{r.text}</p>
          if (r.k === 'sql') return <p key={r.id} className="receipt-sql t-data">{r.text}</p>
          if (r.k === 'text') return <p key={r.id} className="receipt-note">{r.text}</p>
          if (r.k === 'group') return <ClearedGroup key={r.id} id={r.id} label={r.label} tables={r.tables} />
          const total = r.k === 'total'
          return (
            <div
              key={r.id}
              className={total ? 'receipt-line is-total' : 'receipt-line'}
              data-fact={r.k === 'line' ? r.fact : undefined}
              data-table={r.k === 'line' ? r.table : undefined}
              data-figure={r.fig}
            >
              <span className="r-name t-data">{r.name}</span>
              <span className="r-val">
                <span className="r-fig t-data" title={r.k === 'line' ? r.title : undefined}>{r.fig}</span>
                <span className="r-note t-data">{r.k === 'line' ? (r.note ?? '') : ''}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* §5 — deliberately undramatic. It sends an order; it does not act. */}
      <div className="receipt-undo">
        {demo ? (
          <p className="receipt-note">
            This is a recorded run, so the undo cannot be fired from here. In a live session
            there is a control here: it sends the order, and the gate re arms with hold to
            restore. Clone the repository to run it against a database.
          </p>
        ) : spent ? (
          <p className="receipt-note">
            The undo has been fired and the rows are back. It is one shot. The engine refuses a
            second run, because replaying it would duplicate rows.
          </p>
        ) : approvalOpen ? (
          <p className="receipt-note">
            The restore gate is open below. Countersign it, or deny it to leave the change in place.
          </p>
        ) : (
          <>
            {/* Disabled while a turn is in flight: send() has no in-flight guard of
                its own, so a second click here would start a second turn and the
                agent would be asked to restore twice. */}
            <button type="button" className="undo-go" disabled={running} onClick={() => onSend(UNDO_ORDER)}>
              Fire the verified undo
            </button>
            <p className="receipt-note">
              {running
                /* Nothing is queued — the control cannot send while a turn is in
                   flight. "The order will wait" promises a queue that does not exist
                   and leaves the operator waiting for an undo never requested. */
                ? 'the agent is still working; this sends nothing yet. Wait for the turn to finish.'
                : 'sends the order; you will countersign the restore.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
