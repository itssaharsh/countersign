// The interface, drawn in type over the world. No cards: a wordmark, a HUD readout, a
// giant title per phase, a thin transcript rail, one command line, and two typographic
// buttons when the gate is open. A glass slab carries the receipt.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion'
import type { FeedItem, PendingApproval } from '../harness'
import type { Phase, Simulation } from '../state'
import { NumberTicker } from '../components/fx/NumberTicker'
import { FRESHNESS_SECONDS } from './useFreshness'

type Props = {
  phase: Phase; sim?: Simulation; feed: FeedItem[]; running: boolean; pending: PendingApproval[]
  freshnessLeft: number; modelName: string; engineOnline: boolean
  onSend: (t: string) => void; respond: (status: 'allow' | 'deny', reason?: string, toolCallId?: string) => void
}

const TITLE: Record<Phase, [string, string]> = {
  IDLE: ['Show me the', 'consequence.'],
  INVESTIGATING: ['Measuring what', 'would die.'],
  DECIDING: ['Countersign', 'or deny.'],
  WITNESSING: ['Executed.', 'Undo armed.'],
}
const PHASE_COLOR: Record<Phase, string> = { IDLE: 'var(--violet)', INVESTIGATING: 'var(--amber)', DECIDING: 'var(--green)', WITNESSING: 'var(--teal)' }

export function Overlay(p: Props) {
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const pending = p.pending.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const lastAgent = [...p.feed].reverse().find((f) => f.kind === 'assistant' && f.text) as Extract<FeedItem, { kind: 'assistant' }> | undefined
  const isUndo = pending?.toolName === 'fire_undo'
  // What the operator has NOT yet been shown. Mirrors the server's refusal codes: a commit
  // needs blast radius (destructive kinds), a verified undo and a policy PASS; an undo needs
  // a committed change. No loaded simulation for this approval = nothing to countersign.
  const missing: string[] = !p.sim
    ? ['simulation evidence']
    : isUndo
      ? (p.sim.committed ? [] : ['committed change'])
      : ([p.sim.kind === 'destructive-cascade' && !p.sim.fingerprint && 'blast radius', !p.sim.undo.verified && 'verified undo', p.sim.policy?.verdict !== 'PASS' && 'policy pass'].filter(Boolean) as string[])
  const gate: 'BLOCKED' | 'ARMED' | 'STALE' = missing.length ? 'BLOCKED' : p.freshnessLeft <= 0 ? 'STALE' : 'ARMED'
  const [t1, t2] = TITLE[p.phase]
  // The rail is a scrollable, interactive region; keep the newest lines in view as they land.
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = railRef.current; if (el) el.scrollTop = el.scrollHeight }, [p.feed])

  return (
    <div className="overlay">
      <Cursor />
      {/* wordmark */}
      <div className="absolute left-8 top-7 rise">
        <div className="t-giant" style={{ fontSize: 18, letterSpacing: '0.02em' }}>Countersign</div>
        <div className="t-tag mt-1">the approval layer for destructive database changes</div>
      </div>
      {/* HUD */}
      <div className="absolute right-8 top-7 text-right rise" style={{ animationDelay: '.1s' }}>
        <div className="t-tag">TrueForge{p.modelName ? ` · ${p.modelName}` : ''}{p.engineOnline ? '' : ' · engine offline'}</div>
        <div className="t-mono mt-2 text-[12px]" style={{ color: PHASE_COLOR[p.phase] }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: PHASE_COLOR[p.phase], boxShadow: `0 0 12px ${PHASE_COLOR[p.phase]}` }} />
          {p.phase.toLowerCase()}
        </div>
        {p.sim && (
          <div className="t-mono mt-3 text-[11px] space-y-1" style={{ color: 'var(--ink-dim)' }}>
            <Proof ok={Boolean(p.sim.fingerprint) || p.sim.kind === 'reversible'} label="blast radius measured" />
            <Proof ok={p.sim.undo.verified} label={Boolean(p.sim.undo.report) && !p.sim.undo.verified ? 'NOT RESTORED BY THE GENERATED ROLLBACK' : 'undo verified on committed state'} bad={Boolean(p.sim.undo.report) && !p.sim.undo.verified} />
            <Proof ok={p.sim.policy?.verdict === 'PASS'} label="policy pass, deterministic" bad={p.sim.policy?.verdict === 'FAIL'} />
          </div>
        )}
      </div>

      {/* giant title */}
      <div className="absolute left-8 bottom-[170px] max-w-[58vw] title">
        <AnimatePresence mode="wait">
          <motion.div key={p.phase} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="t-giant glow-text" style={{ fontSize: 'clamp(56px, 8.6vw, 132px)' }}>{t1}</div>
            <div className="t-giant" style={{ fontSize: 'clamp(56px, 8.6vw, 132px)', color: PHASE_COLOR[p.phase] }}>{t2}</div>
            {p.phase === 'IDLE' && (
              <div className="t-serif italic mt-5" style={{ fontSize: 22, color: 'var(--ink-dim)', maxWidth: '46ch' }}>
                An approval gate that shows you the command instead of the consequence is a consent form. This one measures first.
              </div>
            )}
            {p.phase === 'INVESTIGATING' && p.sim && (
              <div className="t-serif italic mt-5" style={{ fontSize: 22, color: 'var(--ink-dim)' }}>
                {p.sim.change_sql}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* transcript rail */}
      <div ref={railRef} className="absolute left-8 top-[120px] max-h-[38vh] overflow-y-auto rail panel hit t-mono text-[11px] space-y-1.5" style={{ color: 'var(--ink-dim)', maskImage: 'linear-gradient(#000 80%, transparent)' }}>
        {p.feed.slice(-14).map((f) => <Line key={`${f.kind}:${f.id}`} f={f} />)}
      </div>

      {/* receipt slab */}
      <AnimatePresence>
        {p.phase === 'WITNESSING' && p.sim && (
          <motion.div key="slab" className="slab hit panel absolute right-8 top-[150px] p-6" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.6 }}>
            <div className="t-tag">Execution receipt</div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat label="approved keys" value={p.sim.execution?.scoped_to_pks ?? p.sim.fingerprint?.count ?? 0} color="var(--violet)" />
              <Stat label="root rows removed" value={p.sim.execution?.deleted_root_rows ?? 0} color="var(--coral)" prefix="−" />
              <Stat label="undo statements" value={p.sim.undo.statements} color="var(--green)" />
              <Stat label="tables measured" value={p.sim.tables.length} color="var(--teal)" />
            </div>
            <div className="t-serif italic mt-5 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
              Undo <span style={{ color: 'var(--green)' }}>armed</span>, verified on committed shadow state before the commit was allowed. Say "fire the undo" and every approved row returns.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* gate controls */}
      <AnimatePresence>
        {pending && (
          <motion.div key="gate" className="absolute right-8 bottom-[150px] text-right hit gate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <div className="t-tag">{isUndo ? 'fire the verified undo' : 'commit the change'} · {pending.toolName} · <span style={{ color: gate === 'ARMED' ? 'var(--green)' : gate === 'STALE' ? 'var(--amber)' : 'var(--coral)' }}>{gate.toLowerCase()}</span></div>
            <div className="t-mono mt-2 text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              {gate === 'BLOCKED' ? `missing: ${missing.join(', ')}` : `${isUndo ? '+' : '−'}${p.sim?.fingerprint?.count.toLocaleString()} rows in the fingerprinted set · fresh for ${Math.ceil(p.freshnessLeft)}s of ${FRESHNESS_SECONDS}`}
            </div>
            <div className="mt-5 flex items-end justify-end gap-8">
              <Magnetic><button className="tbtn" disabled={gate !== 'ARMED'} onClick={() => respondAll(p, 'allow', undefined, pending.toolCallId)} style={{ fontSize: 44, color: gate === 'ARMED' ? 'var(--green)' : 'var(--ink-faint)' }}>{isUndo ? 'Restore' : 'Countersign'}<span className="underline" /></button></Magnetic>
              <Magnetic><button className="tbtn" onClick={() => respondAll(p, 'deny', reason || 'denied by operator', pending.toolCallId)} style={{ fontSize: 22, color: 'var(--coral)' }}>Deny<span className="underline" /></button></Magnetic>
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="deny reason, sent back to the agent" className="cmd mt-3 text-right text-[12px]" style={{ width: 320, maxWidth: '100%' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* command line */}
      <div className="absolute left-8 right-8 bottom-8 hit">
        <div className="t-mono text-[13px] mb-3 min-h-[20px]" style={{ color: 'var(--ink-dim)' }}>
          {p.running && <span style={{ color: PHASE_COLOR[p.phase] }}>▮ </span>}
          {lastAgent ? <Typewriter text={lastAgent.text} /> : <span>{p.feed.length ? '' : 'give the agent an order · e.g. Process this change request: DELETE FROM users WHERE last_active < \'2025-01-01\''}</span>}
        </div>
        <div className="hairline" />
        <form className="flex items-center gap-3 pt-3" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { p.onSend(draft.trim()); setDraft('') } }}>
          <span className="t-mono text-[15px]" style={{ color: PHASE_COLOR[p.phase] }}>›</span>
          <input className="cmd" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="transmit an order" autoFocus />
          <button type="submit" className="tbtn" style={{ fontSize: 14, color: 'var(--ink-dim)' }} disabled={p.running}>Send<span className="underline" /></button>
        </form>
      </div>
    </div>
  )
}

function respondAll(p: Props, status: 'allow' | 'deny', reason: string | undefined, id: string) { p.respond(status, reason, id) }

function Proof({ ok, label, bad }: { ok: boolean; label: string; bad?: boolean }) {
  const color = ok ? 'var(--green)' : bad ? 'var(--coral)' : 'var(--ink-faint)'
  return <div><span style={{ color }}>{ok ? '■' : bad ? '✕' : '□'}</span> {label}</div>
}

function Stat({ label, value, color, prefix = '' }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div>
      <div className="t-giant" style={{ fontSize: 30, color }}><NumberTicker value={value} prefix={prefix} /></div>
      <div className="t-tag mt-1">{label}</div>
    </div>
  )
}

function Line({ f }: { f: FeedItem }) {
  if (f.kind === 'user') return <div style={{ color: 'var(--amber)' }}>› {f.text}</div>
  if (f.kind === 'assistant') return f.text ? <div style={{ color: 'var(--ink-dim)' }}>{f.text.replace(/\*\*|`/g, '').slice(0, 160)}{f.text.length > 160 ? '…' : ''}</div> : null
  if (f.kind === 'tool') return <div><span style={{ color: f.status === 'done' ? 'var(--green)' : 'var(--amber)' }}>{f.status === 'done' ? '⏺' : '◌'}</span> {f.name} <span style={{ color: 'var(--ink-faint)' }}>{f.args.slice(0, 60)}</span></div>
  if (f.kind === 'thread') return <div style={{ color: 'var(--violet)' }}>↳ subagent · {f.title}</div>
  return <div style={{ color: /error/i.test(f.text) ? 'var(--coral)' : 'var(--ink-faint)' }}>{f.text}</div>
}

function Typewriter({ text }: { text: string }) {
  const clean = text.replace(/\*\*|`|---/g, '').replace(/\s+/g, ' ').trim()
  const tail = clean.length > 220 ? '…' + clean.slice(-220) : clean
  return <span>{tail}<span className="caret" /></span>
}

function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0), y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18 }), sy = useSpring(y, { stiffness: 220, damping: 18 })
  return (
    <motion.div ref={ref} style={{ x: sx, y: sy, display: 'inline-block' }}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); x.set((e.clientX - (r.left + r.width / 2)) * 0.25); y.set((e.clientY - (r.top + r.height / 2)) * 0.25) }}
      onMouseLeave={() => { x.set(0); y.set(0) }}>
      {children}
    </motion.div>
  )
}

function Cursor() {
  const dx = useMotionValue(-100), dy = useMotionValue(-100)
  const rx = useSpring(dx, { stiffness: 300, damping: 28 }), ry = useSpring(dy, { stiffness: 300, damping: 28 })
  useEffect(() => { const m = (e: MouseEvent) => { dx.set(e.clientX); dy.set(e.clientY) }; window.addEventListener('mousemove', m); return () => window.removeEventListener('mousemove', m) }, [dx, dy])
  return (<><motion.div className="cursor-dot" style={{ left: dx, top: dy }} /><motion.div className="cursor-ring" style={{ left: rx, top: ry }} /></>)
}
