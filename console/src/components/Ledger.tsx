// WITNESSING: what actually happened, measured after the fact — and the armed undo.
import { NumberTicker } from './fx/NumberTicker'
import type { Simulation } from '../state'

export function Ledger({ sim }: { sim: Simulation }) {
  return (
    <div className="card card-strong ring-green relative overflow-hidden px-6 py-5">
      <div className="cs-scanline" />
      <div className="t-display text-[24px] italic">Execution ledger</div>
      <div className="t-label mt-1">committed {sim.committed_at ? new Date(sim.committed_at).toLocaleTimeString() : ''} · we only delete what we can prove we can restore</div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        <Tile label="approved keys" value={sim.execution?.scoped_to_pks ?? sim.fingerprint?.count ?? 0} color="var(--cs-violet)" />
        <Tile label="root rows removed" value={sim.execution?.deleted_root_rows ?? 0} color="var(--cs-coral)" prefix="−" />
        <Tile label="undo statements armed" value={sim.undo.statements} color="var(--cs-green)" />
      </div>
      <div className="mt-4 text-[12.5px] leading-6" style={{ color: 'var(--cs-ink-dim)' }}>
        Undo <span style={{ color: 'var(--cs-green)', fontWeight: 700 }}>{sim.undo.verified ? 'ARMED' : 'not verified'}</span>, verified on committed shadow state before the commit was allowed. Fire it and every approved row provably returns.
      </div>
    </div>
  )
}

function Tile({ label, value, color, prefix = '' }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: `${color}0f`, border: `1px solid ${color}33` }}>
      <div className="t-hud text-[26px]" style={{ color }}><NumberTicker value={value} prefix={prefix} /></div>
      <div className="t-label mt-1">{label}</div>
    </div>
  )
}
