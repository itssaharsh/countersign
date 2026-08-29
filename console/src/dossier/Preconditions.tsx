// DESIGN.md §4/§5 — the three precondition lines.
//
// These are the evidence the countersign control is earned against, and each one
// is read straight out of /state: the fingerprint, the undo report, the policy
// verdict. Not one of them is a status the console decides for itself.
//
// Two rules that are not negotiable:
//  · A failing line is --graphite with a ✕, never --seal. Nothing destructive is
//    being offered on a screen where the evidence does not hold, so nothing on it
//    earns the seal (§5 REFUSED).
//  · The undo failure says NOT RESTORED BY THE GENERATED ROLLBACK, verbatim. The
//    project constitution mandates that phrase over anything softer, because the
//    rollback is a generated artifact and its failure is a fact about that
//    artifact, not an apology.
//
// "POLICY PASSED 4 rules, 0 blocking" — four, and the four are counted from
// sim.policy.rules, which server/src/policy.mjs fills with max_rows_deleted,
// protected_tables, require_verified_undo and restrict_edges_block.
import type { Simulation } from '../state'

const fmt = (n: number) => n.toLocaleString('en-US')

// §6 item 3 — 120ms opacity + 2px rise, staggered 60ms. Instant under
// prefers-reduced-motion (the delay is zeroed in index.css alongside it).
const STAGGER_MS = 60

type Line = { key: string; ok: boolean; label: string; detail: string | null }

function lines(sim: Simulation): Line[] {
  const fp = sim.fingerprint
  // A reversible change has no fingerprint and the server does not ask for one —
  // GateBar's refusal codes only require blast radius for destructive-cascade
  // kinds. Showing a failed prerequisite for a reversible change would report a
  // failure the engine never claimed.
  const measured = sim.kind === 'destructive-cascade' ? Boolean(fp) : true
  const report = (sim.undo.report ?? {}) as { restored_rows?: unknown }
  const restored = Number(report.restored_rows ?? 0)
  const expected = fp?.count ?? 0
  const rules = sim.policy?.rules ?? []
  const blocking = rules.filter((r) => !r.pass)

  return [
    {
      key: 'blast-radius',
      ok: measured,
      label: measured ? 'BLAST RADIUS MEASURED' : 'BLAST RADIUS NOT MEASURED',
      detail: null,
    },
    {
      key: 'undo',
      ok: sim.undo.verified,
      label: sim.undo.verified ? 'UNDO PROVEN' : 'NOT RESTORED BY THE GENERATED ROLLBACK',
      detail: sim.undo.verified
        ? (expected ? `${fmt(restored)}/${fmt(expected)} restored` : null)
        : (expected ? `${fmt(expected - restored)} of ${fmt(expected)} rows did not come back in shadow` : null),
    },
    {
      key: 'policy',
      ok: sim.policy?.verdict === 'PASS',
      label: sim.policy ? (sim.policy.verdict === 'PASS' ? 'POLICY PASSED' : 'POLICY FAILED') : 'POLICY NOT EVALUATED',
      detail: !sim.policy
        ? null
        : sim.policy.verdict === 'PASS'
          ? `${fmt(rules.length)} rules, ${fmt(blocking.length)} blocking`
          : `${blocking[0]?.rule ?? 'policy'} — ${blocking[0]?.detail ?? 'failed'}`,
    },
  ]
}

export function Preconditions({ sim }: { sim: Simulation }) {
  return (
    <ul className="preconds" aria-label="Preconditions">
      {lines(sim).map((l, i) => (
        <li
          key={l.key}
          className={`precond ${l.ok ? 'is-ok' : 'is-fail'}`}
          style={{ animationDelay: `${i * STAGGER_MS}ms` }}
          data-precond={l.key}
          data-ok={l.ok}
        >
          <span className="precond-mark" aria-hidden>{l.ok ? '✓' : '✕'}</span>
          <span className="vh">{l.ok ? 'satisfied: ' : 'not satisfied: '}</span>
          <span className="precond-label t-label">{l.label}</span>
          {l.detail && <span className="precond-detail t-data">{l.detail}</span>}
        </li>
      ))}
    </ul>
  )
}
