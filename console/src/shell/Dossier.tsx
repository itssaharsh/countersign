// DESIGN.md §3 — the right column: the phase-adaptive panel where the boldness
// is spent, and §5's empty state.
//
// The command form is present in every phase, not only the empty one. §0
// requires a stranger to be able to start from this screen alone, and §5's own
// STALE copy instructs the operator to "send the order again", which has to be
// possible while a simulation exists.
import { useState } from 'react'
import type { Phase, Simulation } from '../state'
import { Ledger } from '../dossier/Ledger'
import { Preconditions } from '../dossier/Preconditions'
import { Receipt } from '../dossier/Receipt'
import { Measuring } from '../dossier/Measuring'

// The statement that actually runs against the seeded estate. Never a table or
// column that does not exist — a judge copies this on the one screen that has to
// work from cold.
const PLACEHOLDER = "DELETE FROM users WHERE last_active < '2025-01-01'"

type Props = {
  phase: Phase
  sim?: Simulation
  running: boolean
  // An approval and a question are different states and read differently: one is
  // countersigned or denied, the other answered or declined. Conflating them
  // shows the operator the wrong active state.
  approvalOpen: boolean
  questionOpen: boolean
  onSend: (text: string) => void
}

export function Dossier(p: Props) {
  const [draft, setDraft] = useState('')
  const idle = p.phase === 'IDLE'
  const blocked = p.approvalOpen || p.questionOpen
  const measured = Boolean(p.sim && p.sim.tables.length > 0)
  // The preconditions are a report on evidence, never a progress bar: three ✕
  // lines while the shadow transaction is still running would read as three
  // failures. They appear once the engine has actually reported on any of them.
  const hasEvidence = Boolean(p.sim && (p.sim.fingerprint || p.sim.policy || p.sim.undo.verified))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.trim()) { p.onSend(draft.trim()); setDraft('') }
  }

  return (
    <section className="col-dossier" aria-label={idle ? 'Submit a change' : 'Dossier'}>
      {!idle && (
        <>
          {p.sim && <p className="dossier-sql t-data">{p.sim.change_sql}</p>}

          {p.sim && measured ? (
            <>
              {/* §5 — WITNESSING is the receipt's screen: it carries the per-table
                  figures, the fingerprint, the commit time and the armed undo, so the
                  ledger's forecast is not shown beside it. The same numbers under two
                  headings would leave the operator working out which is the record.
                  Rendered here rather than from an early return, because the command
                  form below has to survive into WITNESSING (#20). */}
              {p.phase === 'WITNESSING'
                ? <Receipt sim={p.sim} onSend={p.onSend} approvalOpen={p.approvalOpen} running={p.running} />
                : <Ledger sim={p.sim} />}
            </>
          ) : (
            <>
              {/* The plain waiting states stay one sentence. INVESTIGATING does not:
                  it is 18 to 43 seconds long, and a single grey line in an empty
                  column is the console's worst screen precisely where the operator
                  most needs to know it has not hung. */}
              {p.phase === 'WITNESSING' || p.questionOpen || p.approvalOpen ? (
                <>
                  <h2 className="t-label">{p.phase === 'WITNESSING' ? 'Receipt' : 'Blast radius'}</h2>
                  <p className="panel-empty">
                    {p.phase === 'WITNESSING'
                      ? 'The commit is done. The per-table figures, the fingerprint and the armed undo appear here.'
                      : p.questionOpen
                        ? 'The agent is asking you something. Answer or decline it below.'
                        : 'The evidence for this approval appears here.'}
                  </p>
                </>
              ) : (
                <Measuring />
              )}
            </>
          )}

          {p.sim && hasEvidence && <Preconditions sim={p.sim} />}
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
          disabled={blocked}
        />
        <p className="submit-note">
          {p.questionOpen
            ? 'The agent asked a question. Answer or decline it below before sending anything else.'
            : p.approvalOpen
              ? 'A gate is open. Countersign or deny it below before sending anything else. The deny reason goes back to the agent.'
              : idle
                ? 'Paste a destructive statement. Nothing runs until you countersign.'
                : 'Ask for a re-measurement, or say "fire the undo" to bring the rows back. Nothing runs until you countersign.'}
        </p>
        <button type="submit" className="submit-go" disabled={p.running || blocked}>
          {idle ? 'Measure it' : 'Send'}
        </button>
      </form>
    </section>
  )
}
