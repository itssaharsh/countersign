// The measured blast radius — animated bars, counted numbers, real FK semantics.
import { motion } from 'framer-motion'
import { NumberTicker } from './fx/NumberTicker'
import type { Simulation, TableRow } from '../state'

const EDGE_COLOR: Record<string, string> = { CASCADE: 'var(--cs-coral)', 'SET NULL': 'var(--cs-amber)', RESTRICT: 'var(--cs-blue)', 'NO ACTION': 'var(--cs-ink-faint)' }

export function CascadeTree({ sim }: { sim: Simulation }) {
  const root = sim.tables.find((t) => t.edge === null)
  const children = sim.tables.filter((t) => t.edge !== null)
  const losing = children.filter((t) => (t.delta ?? 0) > 0 || (t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0))
  const spared = children.filter((t) => !losing.includes(t))
  const sparedTouched = spared.filter((t) => (t.affected ?? 0) > 0)
  const total = sim.tables.reduce((s, t) => s + (t.delta ?? 0), 0)
  const max = Math.max(1, ...sim.tables.map((t) => t.delta || t.affected || 0))
  return (
    <div className="card relative overflow-hidden px-6 py-5">
      <div className="cs-scanline" />
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="t-display text-[24px] italic">Blast radius</div>
          <div className="t-label mt-1">measured, not estimated · every edge is a real foreign key</div>
        </div>
        <div className="text-right">
          <div className="t-hud text-[30px] leading-none" style={{ color: 'var(--cs-coral)' }}><NumberTicker value={total} prefix="−" /></div>
          <div className="t-label mt-1">rows lost in total</div>
        </div>
      </div>
      {root && <Row t={root} max={max} depth={0} />}
      {losing.slice().sort((a, b) => depthOf(a) - depthOf(b) || (b.delta || b.affected || 0) - (a.delta || a.affected || 0))
        .map((t, i) => <Row key={t.name} t={t} max={max} depth={depthOf(t)} index={i + 1} />)}
      {spared.length > 0 && (
        <div className="mt-3 text-[12px]" style={{ color: 'var(--cs-ink-dim)', paddingLeft: 22 }}>
          └ {spared.length} more tables reachable · <span style={{ color: 'var(--cs-green)' }}>0 rows lost</span>
          {sparedTouched.length > 0 && ` · ${sparedTouched.reduce((s, t) => s + (t.affected ?? 0), 0).toLocaleString()} references set NULL across ${sparedTouched.length} tables`}
        </div>
      )}
      <div className="t-label mt-4">simulated in {sim.duration_ms} ms inside begin and rollback · nothing was committed</div>
    </div>
  )
}

function depthOf(t: TableRow): number { return t.edge ? 1 + (t.edge.match(/→/g)?.length ?? 0) : 0 }

function Row({ t, max, depth, index = 0 }: { t: TableRow; max: number; depth: number; index?: number }) {
  const n = t.delta || t.affected || 0
  const color = t.onDelete ? EDGE_COLOR[t.onDelete] : 'var(--cs-coral)'
  const abort = t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0
  return (
    <div className="mb-3" style={{ paddingLeft: Math.min(depth, 4) * 22 }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {depth > 0 && <span className="t-mono text-[12px]" style={{ color }}>└{t.onDelete === 'CASCADE' ? '✕' : '·'}</span>}
          <span className="text-[15px] font-medium tracking-tight">{t.name}</span>
          {t.onDelete && <span className="pill" style={{ color, borderColor: `${color}55`, background: `${color}10`, padding: '3px 10px', fontSize: 10.5 }}>on delete {t.onDelete.toLowerCase()}</span>}
        </div>
        <span className="t-hud text-[20px]" style={{ color: t.delta > 0 ? 'var(--cs-coral)' : abort ? 'var(--cs-blue)' : 'var(--cs-ink-faint)' }}>
          {t.delta > 0 ? <NumberTicker value={t.delta} prefix="−" /> : abort ? 'would abort' : '0'}
        </span>
      </div>
      <div className="h-[9px] mt-2 rounded-full overflow-hidden" style={{ background: 'rgba(23,25,35,0.07)' }}>
        <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}, var(--cs-violet))`, boxShadow: `0 4px 14px -4px ${color}` }}
          initial={{ width: 0 }} animate={{ width: `${(100 * n) / max}%` }} transition={{ duration: 0.55, delay: 0.06 * index, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
    </div>
  )
}
