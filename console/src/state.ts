// Engine truth: the console's evidence surfaces render from the countersign server's
// read-only /state endpoint (or a recorded fixture in replay mode) — measurements,
// never model prose.
import { useEffect, useState } from 'react'

export type TableRow = {
  name: string
  delta: number
  affected?: number
  edge: string | null
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | null
  measured_delta?: number
  note?: string
}
export type Simulation = {
  simulation_id: string
  change_sql: string
  kind: 'destructive-cascade' | 'reversible'
  started_at: string
  duration_ms: number
  tables: TableRow[]
  fingerprint: { count: number; pk_hash: string; pk_column: string; measured_at: string } | null
  undo: { verified: boolean; verified_at: string | null; statements: number; report: Record<string, unknown> | null }
  policy: { verdict: 'PASS' | 'FAIL'; rules: { rule: string; pass: boolean; detail: string }[] } | null
  committed: boolean
  committed_at: string | null
  execution: { scoped_to_pks: number; deleted_root_rows: number } | null
}
export type EngineState = { simulations: Simulation[]; backends: Record<string, string> }

const SERVER = import.meta.env.VITE_COUNTERSIGN_SERVER ?? 'http://127.0.0.1:8977'

export function useEngineState(pollMs = 1500, source?: string): EngineState {
  const [state, setState] = useState<EngineState>({ simulations: [], backends: {} })
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const replay = source ?? params.get('replay')
    // Replaying a recorded event stream without a state fixture: nothing to poll.
    if (!replay && params.has('replayEvents')) return
    let stop = false
    async function tick() {
      try {
        const url = replay ? replay : `${SERVER}/state`
        const res = await fetch(url)
        if (res.ok) {
          const next = (await res.json()) as EngineState
          if (!stop) setState(next)
        }
      } catch {
        /* server not up yet — keep last state */
      }
    }
    tick()
    const t = setInterval(tick, pollMs)
    return () => { stop = true; clearInterval(t) }
  }, [pollMs, source])
  return state
}

/** The run currently on stage: latest simulation. */
export function activeSimulation(s: EngineState): Simulation | undefined {
  return s.simulations[s.simulations.length - 1]
}

/** The simulation an approval refers to — never "the latest one" by assumption. */
export function simulationFor(s: EngineState, id: unknown): Simulation | undefined {
  return typeof id === 'string' ? s.simulations.find((x) => x.simulation_id === id) : undefined
}

export type Phase = 'IDLE' | 'INVESTIGATING' | 'DECIDING' | 'WITNESSING'
export function phaseFor(sim: Simulation | undefined, hasPendingApproval: boolean): Phase {
  if (!sim) return 'IDLE'
  // A pending approval outranks committed state: fire_undo's gate must surface
  // in WITNESSING too, and it does — the Gate renders in both phases.
  if (sim.committed) return 'WITNESSING'
  if (hasPendingApproval) return 'DECIDING'
  return 'INVESTIGATING'
}
