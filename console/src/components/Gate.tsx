// The Allow control as a state machine. It does not exist until the proofs do —
// and the same preconditions are enforced server-side, so this UI is a window
// onto the gate, not the gate itself.
import { useEffect, useState } from 'react'
import type { PendingApproval } from '../harness'
import type { Simulation } from '../state'

const FRESHNESS_SECONDS = 120

type GateState = 'BLOCKED' | 'ARMED' | 'STALE'

export function Gate({ sim, approvals, respond }: {
  sim: Simulation
  approvals: PendingApproval[]
  respond: (status: 'allow' | 'deny', reason?: string) => void
}) {
  const pending = approvals.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const [reason, setReason] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])

  const missing: string[] = []
  if (sim.kind === 'destructive-cascade') {
    if (!sim.fingerprint) missing.push('measured blast radius')
    if (!sim.undo.verified) missing.push('verified undo')
    if (sim.policy?.verdict !== 'PASS') missing.push('policy PASS')
  }
  const measuredAt = sim.fingerprint ? new Date(sim.fingerprint.measured_at).getTime() : now
  const age = (now - measuredAt) / 1000
  const freshLeft = Math.max(0, FRESHNESS_SECONDS - age)
  const state: GateState = missing.length ? 'BLOCKED' : freshLeft <= 0 ? 'STALE' : 'ARMED'

  if (!pending) {
    return (
      <div className="cs-panel p-4 text-center">
        <div className="cs-title text-xs text-[var(--cs-dim)]">GATE · NO PENDING APPROVAL</div>
        <div className="text-[11px] mt-2 text-[var(--cs-dim)]">
          the agent has not requested commit_change — the gate materializes only on a real
          tool.approval_required event from TrueForge
        </div>
      </div>
    )
  }

  return (
    <div className="cs-panel cs-scan p-4 border-2" style={{ borderColor: state === 'ARMED' ? 'var(--cs-green)' : state === 'STALE' ? 'var(--cs-amber)' : 'var(--cs-red)' }}>
      <div className="flex items-center justify-between">
        <div className="cs-title text-xs">HUMAN GATE · {pending.toolName}</div>
        <div className="cs-title text-xs cs-blink" style={{ color: state === 'ARMED' ? 'var(--cs-green)' : state === 'STALE' ? 'var(--cs-amber)' : 'var(--cs-red)' }}>
          {state}
        </div>
      </div>

      {state === 'BLOCKED' && (
        <div className="mt-3 text-[12px] text-[var(--cs-red)]">
          Approve cannot render. Missing: {missing.join(' · ')}.
          <div className="text-[var(--cs-dim)] mt-1">The server refuses without these regardless of this UI.</div>
        </div>
      )}

      {state !== 'BLOCKED' && (
        <>
          <div className="mt-2 text-[11px] text-[var(--cs-dim)]">approving exactly:</div>
          <div className="text-sm mt-1">
            −{sim.fingerprint?.count.toLocaleString()} rows in the fingerprinted set
            <span className="text-[var(--cs-dim)]"> · scoped commit by captured PK list — drift is reported, never destroyed</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[var(--cs-dim)]">
              <span>MEASUREMENT FRESHNESS</span>
              <span>{state === 'STALE' ? 'EXPIRED — RE-MEASURE' : `${Math.ceil(freshLeft)}s`}</span>
            </div>
            <div className="h-1.5 mt-1 bg-[var(--cs-line)]">
              <div className="h-1.5 transition-[width] duration-200" style={{ width: `${(100 * freshLeft) / FRESHNESS_SECONDS}%`, background: state === 'STALE' ? 'var(--cs-amber)' : 'var(--cs-green)' }} />
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button
          disabled={state !== 'ARMED'}
          onClick={() => respond('allow')}
          className="cs-title flex-1 py-2 text-sm border disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--cs-green)', color: 'var(--cs-green)' }}>
          {state === 'ARMED' ? '■ COUNTERSIGN & COMMIT' : state === 'STALE' ? 'STALE — RE-MEASURE FIRST' : 'BLOCKED'}
        </button>
        <button
          onClick={() => respond('deny', reason || 'denied by operator')}
          className="cs-title px-4 py-2 text-sm border"
          style={{ borderColor: 'var(--cs-red)', color: 'var(--cs-red)' }}>
          DENY
        </button>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="deny reason (fed back to the agent)…"
        className="mt-2 w-full bg-transparent border border-[var(--cs-line)] px-2 py-1 text-[11px] outline-none"
      />
    </div>
  )
}
