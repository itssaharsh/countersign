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
  const max = Math.max(1, ...sim.tables.map((t) => t.delta || t.affected || 0))
  return (
    <div className="cs-panel cs-scan p-4">
      <div className="cs-title text-xs text-[var(--cs-dim)] mb-3">BLAST RADIUS · MEASURED, NOT ESTIMATED</div>
      {root && <Row t={root} max={max} depth={0} />}
      {children
        .sort((a, b) => (b.delta || b.affected || 0) - (a.delta || a.affected || 0))
        .map((t) => <Row key={t.name} t={t} max={max} depth={1} />)}
      <div className="mt-3 text-[10px] text-[var(--cs-dim)]">
        every edge is a real foreign key from pg_constraint · simulated in {sim.duration_ms} ms · rolled back
      </div>
    </div>
  )
}

function Row({ t, max, depth }: { t: TableRow; max: number; depth: number }) {
  const n = t.delta || t.affected || 0
  if (n === 0 && depth > 0 && t.onDelete !== 'RESTRICT') return null
  const color = t.onDelete ? EDGE_COLOR[t.onDelete] : 'var(--cs-red)'
  return (
    <div className="mb-2" style={{ paddingLeft: depth * 18 }}>
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
