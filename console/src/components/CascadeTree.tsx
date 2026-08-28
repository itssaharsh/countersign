// The measured blast radius, rendered as the cascade the FK graph actually walked.
import type { Simulation, TableRow } from '../state'

const EDGE_COLOR: Record<string, string> = {
  CASCADE: 'var(--cs-red)',
  'SET NULL': 'var(--cs-amber)',
  RESTRICT: 'var(--cs-cyan)',
  'NO ACTION': 'var(--cs-dim)',
}

export function CascadeTree({ sim }: { sim: Simulation }) {
  const root = sim.tables.find((t) => t.edge === null)
  const children = sim.tables.filter((t) => t.edge !== null)
  // Rows that lose rows (or would abort) lead, ordered by FK depth then size;
  // untouched SET NULL / NO ACTION satellites collapse into one summary line.
  const losing = children.filter((t) => (t.delta ?? 0) > 0 || (t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0))
  const spared = children.filter((t) => !losing.includes(t))
  const sparedTouched = spared.filter((t) => (t.affected ?? 0) > 0)
  const max = Math.max(1, ...sim.tables.map((t) => t.delta || t.affected || 0))
  return (
    <div className="cs-panel cs-scan p-4">
      <div className="cs-title text-xs text-[var(--cs-dim)] mb-3">BLAST RADIUS · MEASURED, NOT ESTIMATED</div>
      {root && <Row t={root} max={max} depth={0} />}
      {losing
        .slice()
        .sort((a, b) => depthOf(a) - depthOf(b) || (b.delta || b.affected || 0) - (a.delta || a.affected || 0))
        .map((t) => <Row key={t.name} t={t} max={max} depth={depthOf(t)} />)}
      {spared.length > 0 && (
        <div className="mt-2 text-[11px] text-[var(--cs-dim)]" style={{ paddingLeft: 18 }}>
          └─· {spared.length} more tables reachable · <span style={{ color: 'var(--cs-amber)' }}>0 rows lost</span>
          {sparedTouched.length > 0 && ` · ${sparedTouched.reduce((s, t) => s + (t.affected ?? 0), 0).toLocaleString()} references set NULL in ${sparedTouched.length} tables`}
        </div>
      )}
      <div className="mt-3 text-[10px] text-[var(--cs-dim)]">
        every edge is a real foreign key from pg_constraint · simulated in {sim.duration_ms} ms · rolled back
      </div>
    </div>
  )
}

function depthOf(t: TableRow): number {
  // edge is the constraint chain root→…→table; arrows count the hops past the first.
  return t.edge ? 1 + (t.edge.match(/→/g)?.length ?? 0) : 0
}

function Row({ t, max, depth }: { t: TableRow; max: number; depth: number }) {
  const n = t.delta || t.affected || 0
  if (n === 0 && depth > 0 && t.onDelete !== 'RESTRICT') return null
  const color = t.onDelete ? EDGE_COLOR[t.onDelete] : 'var(--cs-red)'
  return (
    <div className="mb-2" style={{ paddingLeft: Math.min(depth, 4) * 18 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">
          {depth > 0 && <span style={{ color }}>└─{t.onDelete === 'CASCADE' ? '✕ ' : '· '}</span>}
          {t.name}
          {t.onDelete && (
            <span className="ml-2 text-[10px] px-1 border" style={{ color, borderColor: color }}>
              ON DELETE {t.onDelete}
            </span>
          )}
        </span>
        <span className="cs-title text-base" style={{ color: t.delta > 0 ? 'var(--cs-red)' : 'var(--cs-dim)' }}>
          {t.delta > 0 ? `−${t.delta.toLocaleString()}` : t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0 ? 'WOULD ABORT' : '0'}
        </span>
      </div>
      <div className="h-1 mt-1 bg-[var(--cs-line)]">
        <div className="h-1 cs-bar" style={{ width: `${(100 * n) / max}%`, background: color }} />
      </div>
    </div>
  )
}
