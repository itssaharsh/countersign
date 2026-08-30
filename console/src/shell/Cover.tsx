// The cold-open screen: what a judge, or anyone else, lands on before a change
// has been submitted.
//
// DESIGN.md §5 specifies the empty state as "a single Plex Mono input, full
// width" with one line under it. Built literally, that put a 200px form at the
// top of a 1280px page beside a 72px transcript column and left the rest of the
// viewport blank — the fold fell a long way inside an empty section, and the
// screen said nothing about what the console is for. §5's input is still the
// subject here and still the first control; what is added around it is the
// claim the console exists to make, and the three measurements that have to
// land before the commit control is allowed to exist at all.
//
// Every line is a statement about what the engine actually does: the shadow
// BEGIN…ROLLBACK, the undo replayed against committed shadow state, and the
// four policy rules server/ evaluates by name. Nothing here is a number — the
// cover makes no claim the run has not made yet.
//
// No kicker above the claim. A tracked uppercase label sitting on top of a
// heading is a generated tell and the heading does not need the help.
import type { ReactNode } from 'react'
import { PROOFS } from '../dossier/proofs'

export function Cover({ children }: { children: ReactNode }) {
  return (
    <section className="cover" aria-label="What this console does">
      <h1 className="cover-claim t-display">
        Every approval gate shows you the command.
        <br />
        This one shows you the consequence.
      </h1>

      {/* Below the claim the screen splits the way the working console does: what
          the operator does on the left, what the engine does on the right. */}
      <div className="cover-band">
        <div className="cover-act">
          <p className="cover-lead">
            Countersign sits between an agent and a destructive database change. It measures what
            the change would do before anything runs, and the control that commits it does not
            exist on this page until the evidence does.
          </p>
          {/* §5's input, unchanged: the first control on the screen and the only one. */}
          {children}
        </div>

        <div className="cover-proofs">
          <p className="t-label">What is measured first</p>
          <ol className="cover-proof-list">
            {PROOFS.map((p) => (
              <li key={p.label} className="cover-proof">
                <span className="cover-proof-label t-data">{p.label}</span>
                <span className="cover-proof-body">{p.body}</span>
              </li>
            ))}
          </ol>
          <p className="cover-foot">
            Nothing runs until you countersign, and countersigning is a press and hold.
          </p>
        </div>
      </div>
    </section>
  )
}
