// The three proofs that must exist before the Allow control can materialize.
import type { Simulation } from '../state'

export function ProofLanes({ sim }: { sim: Simulation }) {
  const undoOk = sim.undo.verified
  const policyOk = sim.policy?.verdict === 'PASS'
  const measured = sim.fingerprint !== null || sim.kind === 'reversible'
  const restored = (sim.undo.report as { restored_rows?: number } | null)?.restored_rows
  return (
    <div className="grid grid-cols-3 gap-4">
      <Lane n="01" label="Blast radius" ok={measured}
        detail={measured ? (sim.kind === 'reversible' ? 'additive change, no rows die' : `${sim.fingerprint!.count.toLocaleString()} rows fingerprinted · ${sim.fingerprint!.pk_hash.slice(0, 10)}…`) : 'awaiting shadow execution'} />
      <Lane n="02" label="Undo proof" ok={undoOk} failHard={Boolean(sim.undo.report) && !undoOk}
        detail={undoOk ? (sim.kind === 'reversible' ? 'down-migration verified on shadow' : `replayed on committed shadow state · ${restored ?? ''} rows back, PK set identical`) : sim.undo.report ? 'NOT RESTORED BY THE GENERATED ROLLBACK' : 'not yet verified'} />
      <Lane n="03" label="Policy" ok={policyOk} failHard={sim.policy?.verdict === 'FAIL'}
        detail={sim.policy ? (policyOk ? `${sim.policy.rules.length}/${sim.policy.rules.length} rules pass · deterministic, no LLM` : sim.policy.rules.filter((r) => !r.pass).map((r) => r.detail).join(' · ')) : 'not yet evaluated'} />
    </div>
  )
}

function Lane({ n, label, ok, detail, failHard }: { n: string; label: string; ok: boolean; detail: string; failHard?: boolean }) {
  const color = ok ? 'var(--cs-green)' : failHard ? 'var(--cs-coral)' : 'var(--cs-ink-faint)'
  return (
    <div className={`card px-4 py-4 ${ok ? 'ring-green' : failHard ? 'ring-red' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center w-6 h-6 rounded-full t-hud text-[10px]" style={{ border: `1px solid ${color}`, color }}>{ok ? '✓' : failHard ? '✕' : n}</span>
        <span className="text-[13px] font-semibold tracking-tight">{label}</span>
      </div>
      <div className="text-[11.5px] mt-2.5 leading-5" style={{ color: ok || failHard ? 'var(--cs-ink)' : 'var(--cs-ink-dim)' }}>{detail}</div>
    </div>
  )
}
