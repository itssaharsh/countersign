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
  undo: { verified: boolean; verified_at: string | null; statements: number; report: Record<string, unknown> | null; fired?: boolean }
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
export function phaseFor(sim: Simulation | undefined, hasPendingApproval: boolean, running = false): Phase {
  // The engine publishes a simulation only once run_investigation returns, so for
  // the twenty-odd seconds the agent is measuring there is nothing in /state and
  // the phase would read IDLE — blank, during the longest stretch an operator
  // watches. A running turn with no simulation yet IS the investigation, and §5
  // makes the track the answer to "what is it doing", so it says so.
  if (!sim) return running ? 'INVESTIGATING' : 'IDLE'
  // A pending approval outranks committed state: fire_undo's gate must surface
  // in WITNESSING too, and it does — the Gate renders in both phases.
  if (sim.committed) return 'WITNESSING'
  if (hasPendingApproval) return 'DECIDING'
  return 'INVESTIGATING'
}

/**
 * Foreign-key depth of a measured table: the root of the change has no edge, a
 * direct child has one constraint in its path, a grandchild two. The ledger
 * indents by this.
 */
export function depthOf(t: TableRow): number {
  return t.edge ? t.edge.split('→').length : 0
}

/**
 * Rows that die. Only `delta` counts — a table whose foreign keys are nulled
 * keeps every row it had, and blurring the two would misstate the measurement.
 */
export function rowsThatDie(sim: Simulation | undefined): number {
  return (sim?.tables ?? []).reduce((n, t) => n + (t.delta ?? 0), 0)
}

/**
 * References cleared: rows that survive with a foreign key set to null. Counted
 * separately and never added to the death toll.
 */
export function referencesCleared(sim: Simulation | undefined): number {
  return clearsReferences(sim).reduce((n, t) => n + (t.affected ?? 0), 0)
}

/**
 * Edges whose rows survive with a foreign key set to null. The engine gives every
 * non-CASCADE terminal edge the same zero-delta/affected shape, so filtering on
 * counts alone sweeps RESTRICT edges in with them — and a RESTRICT edge clears
 * nothing. It blocks the delete outright. Classify by the edge's semantics.
 */
export function clearsReferences(sim: Simulation | undefined): TableRow[] {
  return (sim?.tables ?? []).filter((t) => t.onDelete === 'SET NULL' && !(t.delta ?? 0) && (t.affected ?? 0) > 0)
}

/** RESTRICT edges standing in the blast path. These block; they do not clear. */
export function blockingEdges(sim: Simulation | undefined): TableRow[] {
  return (sim?.tables ?? []).filter((t) => t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0)
}

/** The tables that lose rows, root first, then by foreign-key depth. */
export function dyingTables(sim: Simulation | undefined): TableRow[] {
  return (sim?.tables ?? []).filter((t) => (t.delta ?? 0) > 0).sort((a, b) => depthOf(a) - depthOf(b))
}

/** The tables that keep their rows but lose a reference. SET NULL edges only. */
export function touchedTables(sim: Simulation | undefined): TableRow[] {
  return clearsReferences(sim)
}
