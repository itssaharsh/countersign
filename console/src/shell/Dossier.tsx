// DESIGN.md §3 — the right column: the phase-adaptive panel where the boldness
// is spent, and §5's empty state.
//
// Shell only: the blast-radius ledger, the preconditions and the receipt each
// land in their own change. What is here already is the empty state, because
// without it the console cannot be driven at all — and §0 is explicit that a
// stranger with no context has to be able to start from this screen alone.
import { useState } from 'react'
import type { Phase, Simulation } from '../state'

// The statement that actually runs against the seeded estate. Never a table or
// column that does not exist — a judge copies this on the one screen that has to
// work from cold.
const PLACEHOLDER = "DELETE FROM users WHERE last_active < '2025-01-01'"

type Props = {
  phase: Phase
  sim?: Simulation
  running: boolean
  gateOpen: boolean
  onSend: (text: string) => void
}

export function Dossier(p: Props) {
  const [draft, setDraft] = useState('')

  if (p.phase === 'IDLE') {
    return (
      <section className="col-dossier" aria-label="Submit a change">
        <form
          className="submit"
          onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { p.onSend(draft.trim()); setDraft('') } }}
        >
          <label className="t-label" htmlFor="change-sql">The change</label>
          <input
            id="change-sql"
            className="submit-input t-data"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={PLACEHOLDER}
            autoFocus
            spellCheck={false}
          />
          <p className="submit-note">Paste a destructive statement. Nothing runs until you countersign.</p>
          <button type="submit" className="submit-go" disabled={p.running}>Measure it</button>
        </form>
      </section>
    )
  }

  return (
    <section className="col-dossier" aria-label="Dossier">
      <h2 className="t-label">{p.phase === 'WITNESSING' ? 'Receipt' : 'Blast radius'}</h2>
      {p.sim && <p className="dossier-sql t-data">{p.sim.change_sql}</p>}
      <p className="panel-empty">
        {p.gateOpen
          ? 'The evidence for this approval appears here.'
          : 'Measuring. The per-table counts appear here when the shadow transaction reports.'}
      </p>
    </section>
  )
}
