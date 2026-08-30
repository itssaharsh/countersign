// The blast radius drawn as a sectional elevation rather than tabulated.
//
// A foreign-key cascade is a load path failing through dependent members, and a
// section is the drawing you make before cutting. So depth is vertical position,
// magnitude is bar length, and the delta/affected distinction — the one the whole
// product turns on — is carried by drafting convention instead of a column header:
//
//   solid fill   rows removed; the material is gone
//   hatching     cut through but present — a foreign key set to null
//   boundary     a RESTRICT edge: it bounds the excavation and takes nothing
//
// Bars are log-scaled so 6,000 and 19,442 both read, and every figure is printed
// beside its bar, so the scale is never the only source of a number.
import { depthOf, dyingTables, referencesCleared, rowsThatDie, touchedTables, type Simulation } from '../state'

/** Log scale across the range actually present, floored so a small bar still reads. */
function widths(counts: number[]): (n: number) => string {
  const logs = counts.filter((n) => n > 0).map((n) => Math.log10(n))
  const hi = logs.length ? Math.max(...logs) : 1
  const lo = logs.length ? Math.min(...logs) : 0
  const span = Math.max(0.35, hi - lo)
  return (n: number) => {
    if (n <= 0) return '18%'
    const t = (Math.log10(n) - lo) / span
    return `${Math.round(34 + t * 52)}%`
  }
}

export function Section({ sim }: { sim: Simulation }) {
  const dying = dyingTables(sim)
  const touched = touchedTables(sim)
  const cleared = referencesCleared(sim)
  const die = rowsThatDie(sim)
  // A RESTRICT edge with rows behind it fails policy, so the console never draws
  // one as a note; the bounded edge shown here is the harmless case.
  const bounded = sim.tables.filter((t) => t.onDelete === 'RESTRICT')
  const w = widths([...dying.map((t) => t.delta ?? 0), cleared])

  return (
    <section className="section-draw" aria-label="Blast radius by foreign-key depth">
      <h2 className="t-label">Blast radius by foreign key depth</h2>

      <div className="grade">
        <span className="grade-lbl t-data">grade · the table you named</span>
        <span className="grade-rule" />
      </div>

      {dying.map((t) => {
        const d = depthOf(t)
        return (
          <div className="stratum" key={t.name} data-table={t.name} data-delta={t.delta}>
            <div className="st-head">
              <span className="st-name t-data">
                {t.name}
                {d > 0 && <span className="depth-tag"> · depth {d}</span>}
              </span>
              <span className="st-fig t-data">
                {(t.delta ?? 0).toLocaleString()}
                {t.onDelete && <span className="st-edge"> {t.onDelete}</span>}
              </span>
            </div>
            <div className="bar solid" style={{ width: w(t.delta ?? 0) }} />
          </div>
        )
      })}

      {touched.length > 0 && (
        <div className="stratum" data-tables={touched.length} data-cleared={cleared}>
          <div className="st-head">
            <span className="st-name t-data">{touched.length} tables keep their rows</span>
            <span className="st-fig t-data">
              {cleared.toLocaleString()}<span className="st-edge"> SET NULL</span>
            </span>
          </div>
          <div className="bar hatched" style={{ width: w(cleared) }} />
        </div>
      )}

      {bounded.map((t) => (
        <div className="stratum" key={t.name}>
          <div className="st-head">
            <span className="st-name t-data">{t.name}</span>
            <span className="st-fig t-data">
              {(t.affected ?? 0).toLocaleString()}<span className="st-edge"> RESTRICT</span>
            </span>
          </div>
          <div className="bar bound" style={{ width: '18%' }} />
        </div>
      ))}

      <div className={`section-total${sim.undo.report && !sim.undo.verified ? '' : sim.policy?.verdict === 'FAIL' ? '' : ' is-sealed'}`}>
        <span className="section-total-n">{die.toLocaleString()}</span>
        <span className="section-total-l">rows die</span>
      </div>
    </section>
  )
}

/**
 * The preconditions, set as a drawing's revision block: a letter, what was
 * checked, and the measurement that settles it. A revision block is where a
 * drawing records what has been verified and when — which is exactly what these
 * three lines are.
 */
export function Revisions({ sim }: { sim: Simulation }) {
  const fp = sim.fingerprint
  const measured = sim.kind === 'destructive-cascade' ? Boolean(fp) : true
  const report = sim.undo.report as { restored_rows?: unknown } | null
  const restored = Number(report?.restored_rows ?? 0)
  const failing = (sim.policy?.rules ?? []).find((r) => !r.pass)

  const rows = [
    {
      k: 'A', ok: measured,
      label: measured ? 'Blast radius measured' : 'Blast radius not measured',
      meas: `${sim.tables.length} tables`,
    },
    {
      k: 'B', ok: sim.undo.verified,
      label: sim.undo.verified ? 'Undo proven' : 'NOT RESTORED BY THE GENERATED ROLLBACK',
      meas: fp ? `${restored.toLocaleString()} / ${fp.count.toLocaleString()} restored` : 'not verified',
    },
    {
      k: 'C', ok: sim.policy?.verdict === 'PASS',
      label: sim.policy?.verdict === 'PASS' ? 'Policy passed' : 'Policy failed',
      meas: sim.policy?.verdict === 'PASS'
        ? `${sim.policy.rules.length} rules, 0 blocking`
        : failing ? `${failing.rule}: ${failing.detail}` : 'not evaluated',
    },
  ]

  return (
    <div className="revisions" aria-label="Revisions">
      {rows.map((r) => (
        <div className={`revision${r.ok ? '' : ' is-fail'}`} key={r.k}>
          <span className="rev-k t-data">{r.k}</span>
          <span className="rev-t">{r.label}</span>
          <span className="rev-m t-data">{r.meas}</span>
        </div>
      ))}
    </div>
  )
}
