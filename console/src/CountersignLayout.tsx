// The Countersign console — glass over a living backdrop, phase-adaptive.
// Left: the live TrueForge session. Right: evidence the engine measured.
import { AnimatePresence, motion } from 'framer-motion'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, phaseFor, type Phase } from './state'
import { MissionFeed } from './components/MissionFeed'
import { CascadeTree } from './components/CascadeTree'
import { ProofLanes } from './components/ProofLanes'
import { Gate } from './components/Gate'
import { Ledger } from './components/Ledger'
import { Hero } from './components/Hero'
import { Reveal } from './components/fx/Reveal'
import { announcePhase } from './components/fx/Backdrop'
import { useEffect } from 'react'

const PHASE: Record<Phase, { color: string; label: string }> = {
  IDLE: { color: 'var(--cs-ink-faint)', label: 'Standing by' },
  INVESTIGATING: { color: 'var(--cs-blue)', label: 'Investigating' },
  DECIDING: { color: 'var(--cs-amber)', label: 'Awaiting countersign' },
  WITNESSING: { color: 'var(--cs-green)', label: 'Witnessing' },
}

export function CountersignLayout() {
  const { feed, running, pending, send, respond } = useHarness()
  const engine = useEngineState()
  const sim = activeSimulation(engine)
  const phase = phaseFor(sim, pending.length > 0)
  const ph = PHASE[phase]
  useEffect(() => { announcePhase(phase) }, [phase])

  return (
    <div className="h-screen flex flex-col p-5 gap-5">
      <Reveal className="card flex items-center justify-between px-6 py-3.5 shrink-0">
        <div className="flex items-center gap-4">
          <Mark />
          <div className="leading-none">
            <div className="t-display text-[28px] italic" style={{ color: 'var(--cs-ink)' }}>Countersign</div>
            <div className="t-label mt-1.5">The approval layer for destructive database changes</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="pill" style={{ color: 'var(--cs-ink-dim)' }}>TrueForge · gpt-oss-120b</span>
          <motion.span key={phase} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pill" style={{ color: ph.color, borderColor: ph.color, background: `${ph.color}12` }}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${phase !== 'IDLE' ? 'cs-pulse' : ''}`} style={{ background: ph.color }} />
            {ph.label}
          </motion.span>
        </div>
      </Reveal>

      <div className="flex-1 grid grid-cols-[5fr_7fr] gap-5 min-h-0">
        <Reveal delay={0.08} layout className={`card min-h-0 flex flex-col overflow-hidden ${feed.length === 0 ? 'self-end max-h-[260px]' : ''}`}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="t-label">Mission feed · TrueForge session</span>
            {running && <span className="pill cs-pulse" style={{ color: 'var(--cs-blue)', borderColor: 'var(--cs-blue)', background: 'rgba(59,130,246,0.08)' }}>● harness running</span>}
          </div>
          <MissionFeed feed={feed} running={running} onSend={send} />
        </Reveal>

        <div className="min-h-0 overflow-y-auto cs-scroll pr-1">
          <AnimatePresence mode="popLayout">
            {!sim && <Reveal key="hero" delay={0.16} className="max-w-[860px]"><Hero /></Reveal>}
            {sim && phase !== 'WITNESSING' && (
              <motion.div key="investigate" layout className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Reveal className="card px-5 py-4">
                  <div className="t-label mb-1.5">Change under review</div>
                  <code className="t-mono text-[14px] px-2 py-1 rounded-lg" style={{ color: 'var(--cs-coral)', background: 'rgba(255,90,95,0.08)' }}>{sim.change_sql}</code>
                </Reveal>
                <Reveal delay={0.06}><CascadeTree sim={sim} /></Reveal>
                <Reveal delay={0.12}><ProofLanes sim={sim} /></Reveal>
                <Reveal delay={0.18}><Gate sim={sim} approvals={pending} respond={respond} /></Reveal>
              </motion.div>
            )}
            {sim && phase === 'WITNESSING' && (
              <motion.div key="witness" layout className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Reveal><Ledger sim={sim} /></Reveal>
                <Reveal delay={0.06}><Gate sim={sim} approvals={pending} respond={respond} /></Reveal>
                <Reveal delay={0.12}><ProofLanes sim={sim} /></Reveal>
                <Reveal delay={0.18}><CascadeTree sim={sim} /></Reveal>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Mark() {
  return (
    <div className="relative w-11 h-11 grid place-items-center">
      <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_8px_18px_rgba(124,92,255,0.35)] cs-float">
        <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill="rgba(124,92,255,0.10)" stroke="var(--cs-violet)" strokeWidth="2.5" />
        <path d="M24 32l6 6 12-14" fill="none" stroke="var(--cs-green)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
