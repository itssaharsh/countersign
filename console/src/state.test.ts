// The selectors that decide what the operator is told.
//
// These are pure functions over one measurement, and they carry the distinction
// the whole product turns on: rows that die versus rows that survive with a
// reference cleared. A bug here does not crash anything. It quietly reports the
// wrong number to somebody about to approve an irreversible delete, which is the
// one failure mode Countersign exists to prevent.
import { describe, it, expect } from 'vitest'
import {
  blockingEdges,
  clearsReferences,
  depthOf,
  dyingTables,
  phaseFor,
  referencesCleared,
  rowsThatDie,
  simulationFor,
  touchedTables,
  type EngineState,
  type Simulation,
  type TableRow,
} from './state'

const table = (over: Partial<TableRow> & { name: string }): TableRow => ({
  delta: 0, edge: null, onDelete: null, ...over,
})

/** The demo's real shape: a root, two CASCADE descendants, a SET NULL edge, a RESTRICT edge. */
const sim = (tables: TableRow[]): Simulation => ({
  simulation_id: 'sim-1',
  change_sql: "DELETE FROM users WHERE last_active < '2025-01-01'",
  kind: 'destructive-cascade',
  started_at: '2026-08-30T12:00:00.000Z',
  duration_ms: 17800,
  tables,
  fingerprint: null,
  undo: { verified: true, verified_at: null, statements: 3, report: null },
  policy: null,
  committed: false,
  committed_at: null,
  execution: null,
})

const DEMO = sim([
  table({ name: 'users', delta: 6000 }),
  table({ name: 'orders', delta: 17971, edge: 'users→orders', onDelete: 'CASCADE' }),
  table({ name: 'payments', delta: 19442, edge: 'users→orders→payments', onDelete: 'CASCADE' }),
  table({ name: 'sessions', delta: 0, affected: 3542, edge: 'users→sessions', onDelete: 'SET NULL' }),
  table({ name: 'invoices', delta: 0, affected: 0, edge: 'users→invoices', onDelete: 'RESTRICT' }),
])

describe('foreign-key depth', () => {
  it('is zero for the table the operator named', () => {
    expect(depthOf(table({ name: 'users' }))).toBe(0)
  })

  it('counts the constraints in the path, not the tables', () => {
    expect(depthOf(table({ name: 'orders', edge: 'users→orders' }))).toBe(2)
    expect(depthOf(table({ name: 'payments', edge: 'users→orders→payments' }))).toBe(3)
  })
})

describe('rowsThatDie', () => {
  it('is the headline number, and it sums deltas only', () => {
    expect(rowsThatDie(DEMO)).toBe(43413)
  })

  it('never counts a row that merely loses a reference', () => {
    // sessions contributes 3,542 `affected` and must contribute nothing here.
    expect(rowsThatDie(DEMO)).toBe(6000 + 17971 + 19442)
  })

  it('is zero, not NaN, for a simulation that has not measured yet', () => {
    expect(rowsThatDie(undefined)).toBe(0)
    expect(rowsThatDie(sim([]))).toBe(0)
  })
})

describe('clearsReferences', () => {
  it('finds the SET NULL edge', () => {
    expect(clearsReferences(DEMO).map((t) => t.name)).toEqual(['sessions'])
    expect(referencesCleared(DEMO)).toBe(3542)
  })

  // The regression. Both a SET NULL edge and a RESTRICT edge arrive from the
  // engine with zero `delta` and some `affected`, so classifying on counts alone
  // called a RESTRICT edge "references cleared". It clears nothing: it aborts the
  // delete outright. The console would have told the operator that 12 rows had
  // been safely nulled by a change that cannot run at all.
  it('does not sweep in a RESTRICT edge that has rows behind it', () => {
    const blocked = sim([
      table({ name: 'users', delta: 6000 }),
      table({ name: 'invoices', delta: 0, affected: 12, edge: 'users→invoices', onDelete: 'RESTRICT' }),
    ])
    expect(clearsReferences(blocked)).toEqual([])
    expect(referencesCleared(blocked)).toBe(0)
    expect(blockingEdges(blocked).map((t) => t.name)).toEqual(['invoices'])
  })

  it('ignores a RESTRICT edge with nothing behind it, which blocks nothing', () => {
    expect(blockingEdges(DEMO)).toEqual([])
  })

  it('touchedTables is the same set, so the two panels cannot disagree', () => {
    expect(touchedTables(DEMO)).toEqual(clearsReferences(DEMO))
  })
})

describe('dyingTables', () => {
  it('lists only tables that lose rows, root first then by depth', () => {
    expect(dyingTables(DEMO).map((t) => t.name)).toEqual(['users', 'orders', 'payments'])
  })

  it('leaves out a table that only loses a reference', () => {
    expect(dyingTables(DEMO).map((t) => t.name)).not.toContain('sessions')
  })
})

describe('phaseFor', () => {
  it('reads INVESTIGATING while a turn runs before any measurement exists', () => {
    // The engine publishes nothing until run_investigation returns, so without
    // this the track would say IDLE for the twenty seconds an operator watches.
    expect(phaseFor(undefined, false, true)).toBe('INVESTIGATING')
    expect(phaseFor(undefined, false, false)).toBe('IDLE')
  })

  it('reads DECIDING only when something is actually waiting on the operator', () => {
    expect(phaseFor(DEMO, true)).toBe('DECIDING')
    expect(phaseFor(DEMO, false)).toBe('INVESTIGATING')
  })

  it('stays in WITNESSING once committed, including while the undo asks', () => {
    const committed = { ...DEMO, committed: true }
    expect(phaseFor(committed, false)).toBe('WITNESSING')
    expect(phaseFor(committed, true)).toBe('WITNESSING')
  })
})

describe('simulationFor', () => {
  const state: EngineState = { simulations: [DEMO, { ...DEMO, simulation_id: 'sim-2' }], backends: {} }

  it('resolves an approval to the simulation it names, not to the latest', () => {
    expect(simulationFor(state, 'sim-1')?.simulation_id).toBe('sim-1')
  })

  // A gate whose simulation cannot be resolved must stay BLOCKED rather than
  // silently borrowing the most recent measurement, which is how you countersign
  // one change while reading the evidence for another.
  it('returns nothing for an id it cannot resolve or that is not a string', () => {
    expect(simulationFor(state, 'sim-missing')).toBeUndefined()
    expect(simulationFor(state, undefined)).toBeUndefined()
    expect(simulationFor(state, 42)).toBeUndefined()
  })
})
