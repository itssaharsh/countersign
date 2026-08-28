// The Countersign console — a bespoke surface speaking TrueForge's documented protocol
// directly through @truefoundry/trueforge-sdk. Left: the live session. Right: evidence
// measured by the countersign engine, phase-driven by the run.
import { useHarness } from './harness'
import { useEngineState, activeSimulation, phaseFor } from './state'
import { MissionFeed } from './components/MissionFeed'
import { CascadeTree } from './components/CascadeTree'
import { ProofLanes } from './components/ProofLanes'
import { Gate } from './components/Gate'
import { Ledger } from './components/Ledger'

const PHASE_COLOR = {
  IDLE: 'var(--cs-dim)',
  INVESTIGATING: 'var(--cs-cyan)',
  DECIDING: 'var(--cs-amber)',
  WITNESSING: 'var(--cs-green)',
} as const

export function CountersignLayout() {
  const { feed, running, pending, send, respond } = useHarness()
  const engine = useEngineState()
  const sim = activeSimulation(engine)
  const phase = phaseFor(sim, pending.length > 0)

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--cs-line)]">
        <div className="flex items-baseline gap-3">
          <span className="cs-title text-lg" style={{ color: 'var(--cs-amber)' }}>⬢ COUNTERSIGN</span>
          <span className="cs-stamp text-[11px] text-[var(--cs-dim)]">the approval layer for destructive database changes</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="cs-title text-[11px]" style={{ color: PHASE_COLOR[phase] }}>● {phase}</span>
          <span className="text-[10px] text-[var(--cs-dim)]">{engine.backends.live ?? 'engine offline'}</span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[2fr_3fr] gap-4 p-4 min-h-0">
        <section className="cs-panel min-h-0 flex flex-col">
          <div className="cs-title text-[10px] px-3 pt-2 text-[var(--cs-dim)]">MISSION FEED · TRUEFORGE SESSION</div>
          <MissionFeed feed={feed} running={running} onSend={send} />
        </section>

        <section className="min-h-0 overflow-y-auto space-y-4 pr-1">
          {!sim && (
            <div className="cs-panel cs-scan p-8 text-center">
              <div className="cs-stamp text-2xl" style={{ color: 'var(--cs-amber)' }}>NO ACTIVE DOSSIER</div>
              <div className="text-[12px] mt-3 text-[var(--cs-dim)]">
                Transmit an order. The evidence board fills as the shadow execution
                measures — nothing here is estimated.
              </div>
            </div>
          )}
          {sim && phase !== 'WITNESSING' && (
            <>
              <div className="cs-panel p-3">
                <div className="cs-title text-[10px] text-[var(--cs-dim)]">CHANGE UNDER REVIEW</div>
                <code className="text-[13px] block mt-1" style={{ color: 'var(--cs-amber)' }}>{sim.change_sql}</code>
              </div>
              <CascadeTree sim={sim} />
              <ProofLanes sim={sim} />
              <Gate sim={sim} approvals={pending} respond={respond} />
            </>
          )}
          {sim && phase === 'WITNESSING' && (
            <>
              <Ledger sim={sim} />
              <ProofLanes sim={sim} />
              <CascadeTree sim={sim} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
