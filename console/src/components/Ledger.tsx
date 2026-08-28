// WITNESSING: what actually happened, measured after the fact — and the armed undo.
import type { Simulation } from '../state'

export function Ledger({ sim }: { sim: Simulation }) {
  return (
    <div className="cs-panel p-4">
      <div className="cs-title text-xs text-[var(--cs-dim)]">EXECUTION LEDGER</div>
      <div className="mt-2 text-sm space-y-1">
        <div>
          <span className="text-[var(--cs-dim)]">committed:</span>{' '}
          <span style={{ color: 'var(--cs-red)' }}>{sim.committed_at}</span>
        </div>
        {sim.execution && (
          <div>
            <span className="text-[var(--cs-dim)]">scoped to:</span>{' '}
            {sim.execution.scoped_to_pks.toLocaleString()} approved PKs ·{' '}
            <span className="text-[var(--cs-dim)]">deleted:</span>{' '}
            <span style={{ color: 'var(--cs-red)' }}>{sim.execution.deleted_root_rows.toLocaleString()} root rows</span>
          </div>
        )}
        <div>
          <span className="text-[var(--cs-dim)]">undo:</span>{' '}
          <span style={{ color: 'var(--cs-green)' }}>
            {sim.undo.verified ? `ARMED — ${sim.undo.statements} statements, verified on committed shadow state` : 'not verified'}
          </span>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-[var(--cs-dim)]">
        we only delete what we can prove we can restore
      </div>
    </div>
  )
}
