// INVESTIGATING, before the shadow transaction returns.
//
// This is the longest stretch of the run — 18 to 43 seconds across four recorded
// takes — and it was one grey sentence in an otherwise empty column. The operator
// is left asking whether it has hung, and the console had nothing to answer with.
//
// What it can honestly say is what is being measured and why nothing is moving.
// The ledger arrives complete in ONE tool
// result, and copy claiming rows arrive as the shadow transaction reports them
// would be a claim the console cannot make today. So this panel says the opposite
// in as many words, and lists the three measurements as pending, never as
// progress. There is no bar, no spinner and no percentage: the only honest
// progress indicator in the run is the elapsed counter on the open tool call in
// the transcript, which is already there.
import { PROOFS } from './proofs'

export function Measuring() {
  return (
    <div className="measuring">
      <h2 className="t-label">Blast radius</h2>
      <p className="panel-note">
        Measuring inside a shadow transaction. Nothing is published until it returns: this is one
        BEGIN and ROLLBACK, not a stream, so the counts arrive complete or not at all.
      </p>
      <ol className="cover-proof-list" aria-label="Measurements in progress">
        {PROOFS.map((p) => (
          <li key={p.label} className="cover-proof is-pending">
            <span className="cover-proof-label t-data">
              {/* A dot, not a tick and not a cross: three ✕ marks while the
                  transaction is still open would read as three failures (§4). */}
              <span className="proof-mark" aria-hidden>·</span>
              {p.label}
            </span>
            <span className="cover-proof-body">{p.body}</span>
          </li>
        ))}
      </ol>
      <p className="panel-note measuring-foot">
        <span className="vh">Status: </span>
        Pending. Each line is reported on below when the tool returns.
      </p>
    </div>
  )
}
