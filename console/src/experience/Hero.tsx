// The live console, drawn over the stage. Four regions that never overlap: a top bar,
// the title zone (left), the conversation rail (right, scrolls inside itself) and the
// dock (bottom: your order, the agent's words, the command line).
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion'
import type { FeedItem, PendingApproval } from '../harness'
import type { Phase, Simulation } from '../state'
import { NumberTicker } from '../components/fx/NumberTicker'
import { Magnetic } from '../story/fx'
import { FRESHNESS_SECONDS } from './useFreshness'

type Props = {
  phase: Phase; sim?: Simulation; feed: FeedItem[]; running: boolean; pending: PendingApproval[]
  freshnessLeft: number; modelName: string; engineOnline: boolean; scroll: MotionValue<number>
  onSend: (t: string) => void; respond: (status: 'allow' | 'deny', reason?: string, toolCallId?: string) => void
  answer: (toolCallId: string, content: string) => void
}

const EXAMPLE = "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'"

const TITLE: Record<Phase, [string, string]> = {
  IDLE: ['Show me the', 'consequence.'],
  INVESTIGATING: ['Measuring what', 'would die.'],
  DECIDING: ['Countersign', 'or deny.'],
  WITNESSING: ['Executed.', 'Undo armed.'],
}
const PHASE_COLOR: Record<Phase, string> = { IDLE: 'var(--violet)', INVESTIGATING: 'var(--amber)', DECIDING: 'var(--green)', WITNESSING: 'var(--teal)' }
const SUB: Record<Phase, string> = {
  IDLE: 'An agent on TrueForge that runs your destructive SQL in a shadow transaction, counts every row it would take with it, proves the rollback, and only then lets you approve.',
  INVESTIGATING: 'Shadow execution on the live database. Per-table counts through the real foreign keys, then the undo is tested on committed shadow state.',
  DECIDING: 'TrueForge is paused on commit_change. The approval is a fingerprint of the exact rows you see. It expires; drift voids it.',
  WITNESSING: 'The commit deleted by the approved key list, nothing else. The undo was proven before the commit was allowed. Say "fire the undo" to bring every row back.',
}

export function Hero(p: Props) {
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const pending = p.pending.find((a) => a.kind !== 'question' && (a.toolName === 'commit_change' || a.toolName === 'fire_undo'))
  const question = p.pending.find((a) => a.kind === 'question')
  const [answerText, setAnswerText] = useState('')
  const lastAgent = [...p.feed].reverse().find((f) => f.kind === 'assistant' && f.text) as Extract<FeedItem, { kind: 'assistant' }> | undefined
  const lastOrder = [...p.feed].reverse().find((f) => f.kind === 'user') as Extract<FeedItem, { kind: 'user' }> | undefined
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
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = railRef.current; if (el) el.scrollTop = el.scrollHeight }, [p.feed])
  // parallax: the title drifts up and fades as the story scrolls over the stage
  const ty = useTransform(p.scroll, [0, 1], [0, -160])
  const fade = useTransform(p.scroll, [0, 0.55], [1, 0])

  return (
    <section className="hero" id="stage">
      <div className="hero-top">
        <div className="rise">
          <div className="t-giant" style={{ fontSize: 18, letterSpacing: '0.02em' }}>Countersign</div>
          <div className="t-tag mt-1">the approval layer for destructive database changes</div>
        </div>
        <div className="text-right rise" style={{ animationDelay: '.1s' }}>
          <div className="t-tag">TrueForge{p.modelName ? <span className="model"> · {p.modelName}</span> : null}{p.engineOnline ? '' : ' · engine offline'}</div>
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
      </div>

      {/* title zone */}
      <motion.div className="hero-title" style={{ y: ty, opacity: fade }}>
        {/* keyed remount, no exit choreography: a phase change must never wait on a
            stalled exit animation (the title is state, not decoration) */}
        <div>
          <motion.div key={p.phase} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="t-giant glow-text" style={{ fontSize: 'clamp(34px, min(6.6vw, 7.3cqw), 118px)' }}>{t1}</div>
            <div className="t-giant" style={{ fontSize: 'clamp(34px, min(6.6vw, 7.3cqw), 118px)', color: PHASE_COLOR[p.phase] }}>{t2}</div>
            <div className="t-serif italic mt-6" style={{ fontSize: 'clamp(17px, 1.35vw, 22px)', lineHeight: 1.3, color: 'var(--ink-dim)', maxWidth: '52ch' }}>
              {p.phase === 'INVESTIGATING' && p.sim ? <span className="t-mono not-italic text-[14px]" style={{ color: 'var(--amber)' }}>{p.sim.change_sql}</span> : SUB[p.phase]}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* conversation rail */}
      <div className="hero-rail">
        <AnimatePresence>
          {p.phase === 'WITNESSING' && p.sim && (
            <motion.div key="slab" className="slab hit p-6" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.6 }}>
              <div className="t-tag">Execution receipt</div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Stat label="approved keys" value={p.sim.execution?.scoped_to_pks ?? p.sim.fingerprint?.count ?? 0} color="var(--violet)" />
                <Stat label="root rows removed" value={p.sim.execution?.deleted_root_rows ?? 0} color="var(--coral)" prefix="−" />
                <Stat label="undo statements" value={p.sim.undo.statements} color="var(--green)" />
                <Stat label="tables measured" value={p.sim.tables.length} color="var(--teal)" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {p.feed.length > 0 && (
          <div ref={railRef} className="transcript hit" data-lenis-prevent>
            <div className="t-tag mb-2">transcript</div>
            {p.feed.slice(-24).map((f) => <Line key={`${f.kind}:${f.id}`} f={f} />)}
          </div>
        )}
        <AnimatePresence>
          {question && (
            <motion.div key="question" className="text-right hit" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <div className="t-tag">the agent asks · {question.toolName}</div>
              <div className="body mt-2" style={{ color: 'var(--ink)', maxWidth: '44ch', marginLeft: 'auto' }}>{String((question.args as { question?: unknown; prompt?: unknown; message?: unknown }).question ?? (question.args as { prompt?: unknown }).prompt ?? (question.args as { message?: unknown }).message ?? JSON.stringify(question.args))}</div>
              <form className="mt-3 flex items-center justify-end gap-4" onSubmit={(e) => { e.preventDefault(); if (answerText.trim()) { p.answer(question.toolCallId, answerText.trim()); setAnswerText('') } }}>
                <input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="your answer, sent back to the agent" className="cmd text-right text-[13px]" style={{ width: 320, maxWidth: '100%' }} />
                <button type="submit" className="tbtn" style={{ fontSize: 20, color: 'var(--amber)' }}>Answer<span className="underline" /></button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {pending && (
            <motion.div key="gate" className="text-right hit" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <div className="t-tag">{isUndo ? 'fire the verified undo' : 'commit the change'} · {pending.toolName} · <span style={{ color: gate === 'ARMED' ? 'var(--green)' : gate === 'STALE' ? 'var(--amber)' : 'var(--coral)' }}>{gate.toLowerCase()}</span></div>
              <div className="t-mono mt-2 text-[12px]" style={{ color: 'var(--ink-dim)' }}>
                {gate === 'BLOCKED' ? `missing: ${missing.join(', ')}` : `${isUndo ? '+' : '−'}${p.sim?.fingerprint?.count.toLocaleString()} rows in the fingerprinted set · fresh for ${Math.ceil(p.freshnessLeft)}s of ${FRESHNESS_SECONDS}`}
              </div>
              <div className="mt-4 flex items-end justify-end gap-7">
                <Magnetic><button className="tbtn" disabled={gate !== 'ARMED'} onClick={() => p.respond('allow', undefined, pending.toolCallId)} style={{ fontSize: 40, color: gate === 'ARMED' ? 'var(--green)' : 'var(--ink-faint)' }}>{isUndo ? 'Restore' : 'Countersign'}<span className="underline" /></button></Magnetic>
                <Magnetic><button className="tbtn" onClick={() => p.respond('deny', reason || 'denied by operator', pending.toolCallId)} style={{ fontSize: 20, color: 'var(--coral)' }}>Deny<span className="underline" /></button></Magnetic>
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="deny reason, sent back to the agent" className="cmd mt-3 text-right text-[12px]" style={{ width: 320, maxWidth: '100%' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!p.feed.length && <div className="scroll-cue">scroll · how it works ↓</div>}

      {/* dock */}
      <div className="dock hit">
        <div className="flex items-center gap-3 min-h-[26px]">
          {lastOrder ? (
            <>
              <span className="chip" style={{ color: 'var(--amber)' }}>order</span>
              <span className="t-mono text-[12.5px] truncate" style={{ color: 'var(--ink)' }}>{lastOrder.text}</span>
            </>
          ) : (
            <button type="button" className="linkish t-mono text-[12.5px]" onClick={() => setDraft(EXAMPLE)} title="Put this order in the command line">try: {EXAMPLE}</button>
          )}
        </div>
        <div className="say">
          {p.running && <span style={{ color: PHASE_COLOR[p.phase] }}>▮ </span>}
          {lastAgent ? <Typewriter text={lastAgent.text} /> : <span style={{ color: 'var(--ink-faint)' }}>{p.feed.length ? 'the agent is working; its words land here' : 'the agent answers here, the evidence lands on the right, the stage shows what it measured'}</span>}
        </div>
        <div className="hairline" />
        <form className="flex items-center gap-3 pt-1" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { p.onSend(draft.trim()); setDraft('') } }}>
          <span className="t-mono text-[15px]" style={{ color: PHASE_COLOR[p.phase] }}>›</span>
          <input className="cmd" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={pending ? 'a gate is open: countersign or deny it above before sending anything else' : question ? 'the agent asked a question: answer it above first' : 'transmit an order'} autoFocus />
          <button type="submit" className="tbtn" style={{ fontSize: 14, color: 'var(--ink-dim)' }} disabled={p.running}>Send<span className="underline" /></button>
        </form>
      </div>
    </section>
  )
}

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
  if (f.kind === 'user') return <div className="order"><span className="t-tag" style={{ color: 'var(--amber)' }}>you</span><div className="mt-1">{f.text}</div></div>
  if (f.kind === 'assistant') return f.text ? <div className="row"><span style={{ color: 'var(--violet)' }}>◆</span><span>{f.text.replace(/\*\*|`|#+ /g, '').replace(/\s+/g, ' ').slice(0, 220)}{f.text.length > 220 ? '…' : ''}</span></div> : null
  if (f.kind === 'tool') return <div className="row"><span style={{ color: f.status === 'done' ? 'var(--green)' : 'var(--amber)' }}>{f.status === 'done' ? '⏺' : '◌'}</span><span><b style={{ color: 'var(--ink)' }}>{f.name}</b> <span style={{ color: 'var(--ink-faint)' }}>{f.args.slice(0, 70)}</span></span></div>
  if (f.kind === 'thread') return <div className="row"><span style={{ color: 'var(--violet)' }}>↳</span><span>subagent · {f.title}</span></div>
  return <div className="row"><span style={{ color: /error/i.test(f.text) ? 'var(--coral)' : 'var(--ink-faint)' }}>·</span><span style={{ color: /error/i.test(f.text) ? 'var(--coral)' : 'var(--ink-faint)' }}>{f.text}</span></div>
}

function Typewriter({ text }: { text: string }) {
  const clean = text.replace(/\*\*|`|---|#+ /g, '').replace(/\s+/g, ' ').trim()
  const tail = clean.length > 260 ? '…' + clean.slice(-260) : clean
  return <span>{tail}<span className="caret" /></span>
}

export function Cursor() {
  const dx = useMotionValue(-100), dy = useMotionValue(-100)
  const rx = useSpring(dx, { stiffness: 300, damping: 28 }), ry = useSpring(dy, { stiffness: 300, damping: 28 })
  useEffect(() => { const m = (e: MouseEvent) => { dx.set(e.clientX); dy.set(e.clientY) }; window.addEventListener('mousemove', m); return () => window.removeEventListener('mousemove', m) }, [dx, dy])
  return (<><motion.div className="cursor-dot" style={{ left: dx, top: dy }} /><motion.div className="cursor-ring" style={{ left: rx, top: ry }} /></>)
}
