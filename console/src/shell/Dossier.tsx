// DESIGN.md §3 — the right column: the phase-adaptive panel where the boldness
// is spent, and §5's empty state.
//
// The ledger, preconditions and receipt each land in their own change. What is
// here already is the command form, in every phase — not only the empty one.
// §0 requires a stranger to be able to start from this screen alone, and §5's
// own STALE copy instructs the operator to "send the order again", which has to
// be possible while a simulation exists.
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
  const idle = p.phase === 'IDLE'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.trim()) { p.onSend(draft.trim()); setDraft('') }
  }

  return (
    <section className="col-dossier" aria-label={idle ? 'Submit a change' : 'Dossier'}>
      {!idle && (
        <>
          <h2 className="t-label">{p.phase === 'WITNESSING' ? 'Receipt' : 'Blast radius'}</h2>
          {p.sim && <p className="dossier-sql t-data">{p.sim.change_sql}</p>}
          <p className="panel-empty">
            {p.gateOpen
              ? 'The evidence for this approval appears here.'
              : 'Measuring. The per-table counts appear here when the shadow transaction reports.'}
          </p>
        </>
      )}

      <form className={idle ? 'submit' : 'submit is-compact'} onSubmit={submit}>
        <label className="t-label" htmlFor="change-sql">
          {idle ? 'The change' : 'Send another order'}
        </label>
        <input
          id="change-sql"
          className="submit-input t-data"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={idle ? PLACEHOLDER : 'fire the undo'}
          autoFocus={idle}
          spellCheck={false}
          // The harness refuses an order while a gate is open and explains why;
          // saying so here is better than letting the send fail.
          disabled={p.gateOpen}
        />
        <p className="submit-note">
          {p.gateOpen
            ? 'A gate is open. Countersign or deny it below before sending anything else — the deny reason goes back to the agent.'
            : idle
              ? 'Paste a destructive statement. Nothing runs until you countersign.'
              : 'Ask for a re-measurement, or say "fire the undo" to bring the rows back. Nothing runs until you countersign.'}
        </p>
        <button type="submit" className="submit-go" disabled={p.running || p.gateOpen}>
          {idle ? 'Measure it' : 'Send'}
        </button>
      </form>
    </section>
  )
}
