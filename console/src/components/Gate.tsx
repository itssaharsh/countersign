// The Allow control as a state machine. It does not exist until the proofs do —
// and the same preconditions are enforced server-side; this UI is a window onto
// the gate, not the gate itself.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BorderBeam } from './fx/BorderBeam'
import type { PendingApproval } from '../harness'
import type { Simulation } from '../state'

const FRESHNESS_SECONDS = 120
const LOAD_TIME = Date.now()
const REPLAY_MODE = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('replay') || new URLSearchParams(window.location.search).has('replayEvents'))
type GateState = 'BLOCKED' | 'ARMED' | 'STALE'

export function Gate({ sim, approvals, respond }: { sim: Simulation; approvals: PendingApproval[]; respond: (status: 'allow' | 'deny', reason?: string, toolCallId?: string) => void }) {
  const pending = approvals.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const [reason, setReason] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])

  const missing: string[] = []
  if (sim.kind === 'destructive-cascade') {
    if (!sim.fingerprint) missing.push('measured blast radius')
    if (!sim.undo.verified) missing.push('verified undo')
    if (sim.policy?.verdict !== 'PASS') missing.push('policy pass')
  }
  const measuredRaw = sim.fingerprint ? new Date(sim.fingerprint.measured_at).getTime() : now
  // Replayed sessions carry old timestamps; ONLY in replay mode anchor freshness to
  // page load so the meter still tells the story. Live runs keep the true timestamp,
  // so stale live evidence reads STALE (Qodo PR10#1).
  const measuredAt = REPLAY_MODE && measuredRaw < LOAD_TIME - 10 * 60_000 ? LOAD_TIME : measuredRaw
  const freshLeft = Math.max(0, FRESHNESS_SECONDS - (now - measuredAt) / 1000)
  const state: GateState = missing.length ? 'BLOCKED' : freshLeft <= 0 ? 'STALE' : 'ARMED'
  const color = state === 'ARMED' ? 'var(--cs-green)' : state === 'STALE' ? 'var(--cs-amber)' : 'var(--cs-coral)'
  const isUndo = pending?.toolName === 'fire_undo'

  if (!pending) {
    return (
      <div className="card px-6 py-5 text-center">
        <div className="t-label">Human gate · no pending approval</div>
        <div className="text-[12px] mt-2 leading-5" style={{ color: 'var(--cs-ink-dim)' }}>
          The gate materializes only on a real <span className="t-mono">tool.approval_required</span> event from TrueForge.
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={`card card-strong relative px-6 py-5 ${state === 'ARMED' ? 'ring-green' : state === 'STALE' ? 'ring-amber' : 'ring-red'}`}>
      {state === 'ARMED' && <><BorderBeam color={color} /><span className="gate-pulse" /></>}
      <div className="flex items-center justify-between">
        <div>
          <div className="t-display text-[24px] italic">Human gate</div>
          <div className="t-label mt-1">{isUndo ? 'Fire the verified undo' : 'Commit the change'} · <span className="t-mono normal-case tracking-normal">{pending.toolName}</span></div>
        </div>
        <span className="pill cs-pulse" style={{ color, borderColor: color, background: `${color}12` }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />{state}
        </span>
      </div>

      {state === 'BLOCKED' ? (
        <div className="mt-4 text-[13px] leading-6" style={{ color: 'var(--cs-coral)' }}>
          Approve cannot render. Missing: {missing.join(' · ')}.
          <div style={{ color: 'var(--cs-ink-dim)' }}>The server refuses without these regardless of this UI.</div>
        </div>
      ) : (
        <>
          <div className="mt-4 text-[15px] leading-6">
            <span style={{ color: 'var(--cs-ink-dim)' }}>approving exactly </span>
            <span className="t-hud" style={{ color }}>{isUndo ? '+' : '−'}{sim.fingerprint?.count.toLocaleString()}</span>
            <span style={{ color: 'var(--cs-ink-dim)' }}> rows in the fingerprinted set, scoped by captured primary keys. Drift is reported, never destroyed.</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between t-label">
              <span>measurement freshness</span>
              <span style={{ color }}>{state === 'STALE' ? 'expired, re-measure' : `${Math.ceil(freshLeft)}s`}</span>
            </div>
            <div className="h-[9px] mt-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(23,25,35,0.07)' }}>
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(100 * freshLeft) / FRESHNESS_SECONDS}%`, background: `linear-gradient(90deg, ${color}, var(--cs-teal))`, boxShadow: `0 4px 14px -4px ${color}` }} />
            </div>
          </div>
        </>
      )}

      <div className="mt-5 flex gap-3">
        <button disabled={state !== 'ARMED'} onClick={() => respond('allow', undefined, pending.toolCallId)}
          className={`btn flex-1 py-3.5 text-[14px] disabled:cursor-not-allowed ${state === 'ARMED' ? 'btn-go' : ''}`}
          style={state === 'ARMED' ? undefined : { background: 'rgba(23,25,35,0.06)', color: 'var(--cs-ink-dim)' }}>
          {state === 'ARMED' ? (isUndo ? 'Countersign and restore' : 'Countersign and commit') : state === 'STALE' ? 'Stale, re-measure first' : 'Blocked'}
        </button>
        <button onClick={() => respond('deny', reason || 'denied by operator', pending.toolCallId)}
          className="btn btn-ghost px-6 py-3.5 text-[13px]">
          Deny
        </button>
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Deny reason, sent back to the agent"
        className="mt-3 w-full rounded-full px-4 py-2 text-[12px] outline-none" style={{ background: '#fff', border: '1px solid var(--cs-line)', color: 'var(--cs-ink)' }} />
    </motion.div>
  )
}
