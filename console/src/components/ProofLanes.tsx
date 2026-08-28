// The three proofs that must exist before the Allow control can materialize.
import type { Simulation } from '../state'

export function ProofLanes({ sim }: { sim: Simulation }) {
  const undoOk = sim.undo.verified
  const policyOk = sim.policy?.verdict === 'PASS'
  const measured = sim.fingerprint !== null || sim.kind === 'reversible'
  return (
    <div className="grid grid-cols-3 gap-3">
      <Lane
        label="01 · BLAST RADIUS"
        ok={measured}
        detail={measured
          ? sim.kind === 'reversible'
            ? 'additive change — no rows die'
            : `${sim.fingerprint!.count.toLocaleString()} rows fingerprinted (${sim.fingerprint!.pk_hash.slice(0, 12)}…)`
          : 'awaiting shadow execution'}
      />
      <Lane
        label="02 · UNDO PROOF"
        ok={undoOk}
        detail={undoOk
          ? sim.kind === 'reversible'
            ? 'auto down-migration armed'
            : `replayed on COMMITTED shadow state — ${String((sim.undo.report as { restored_rows?: number } | null)?.restored_rows ?? '')} rows restored, PK set identical`
          : sim.undo.report
            ? 'NOT RESTORED BY THE GENERATED ROLLBACK'
            : 'not yet verified'}
        failHard={Boolean(sim.undo.report) && !undoOk}
      />
      <Lane
        label="03 · POLICY"
        ok={policyOk}
        detail={sim.policy
          ? sim.policy.verdict === 'PASS'
            ? `${sim.policy.rules.length}/${sim.policy.rules.length} rules pass (deterministic, no LLM)`
            : sim.policy.rules.filter((r) => !r.pass).map((r) => r.detail).join(' · ')
          : 'not yet evaluated'}
        failHard={sim.policy?.verdict === 'FAIL'}
      />
    </div>
  )
}

function Lane({ label, ok, detail, failHard }: { label: string; ok: boolean; detail: string; failHard?: boolean }) {
  const color = ok ? 'var(--cs-green)' : failHard ? 'var(--cs-red)' : 'var(--cs-dim)'
  return (
    <div className="cs-panel p-3">
      <div className="cs-title text-[10px]" style={{ color }}>
        {ok ? '■' : failHard ? '✕' : '□'} {label}
      </div>
      <div className="text-[11px] mt-2 leading-4 text-[var(--cs-text)]">{detail}</div>
    </div>
  )
}
