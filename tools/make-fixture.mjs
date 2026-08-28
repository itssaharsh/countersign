// Drive the engine through the happy path directly (no model needed) and dump the
// /state payload as a replay fixture for the console + judges' zero-key mode.
import { writeFileSync, mkdirSync } from 'node:fs';
import { live, shadow, describeBackends } from '../server/src/db.mjs';
import { simulateChange, simulations } from '../server/src/simulate.mjs';
import { verifyUndo, recordPolicy } from '../server/src/verify.mjs';
import { evaluatePolicy } from '../server/src/policy.mjs';
// corruption guard: a PGlite data dir must have exactly one attached process.
try {
  const r = await fetch('http://127.0.0.1:8977/state', { signal: AbortSignal.timeout(1500) });
  if (r.ok) {
    console.error('REFUSED: countersign server is running and owns the PGlite dirs. Use POST /admin/reseed, or stop the server first.');
    process.exit(2);
  }
} catch { /* server down — safe to proceed */ }


const CHANGE = process.argv[2] ?? "DELETE FROM users WHERE last_active < '2025-01-01'";
const liveDb = await live();
const shadowDb = await shadow();

const sim = await simulateChange(liveDb, CHANGE);
if (sim.error) { console.error(sim); process.exit(1); }
await verifyUndo(shadowDb, sim.simulation_id);
const rec = simulations.get(sim.simulation_id);
recordPolicy(sim.simulation_id, evaluatePolicy({ tables: rec.tables, undo: rec.undo }));

const state = {
  simulations: [...simulations.values()].map((s) => ({
    simulation_id: s.simulation_id, change_sql: s.change_sql, kind: s.kind,
    started_at: s.started_at, duration_ms: s.duration_ms, tables: s.tables,
    fingerprint: s.fingerprint, policy: s.policy ?? null,
    undo: { verified: s.undo?.verified ?? false, verified_at: s.undo?.verified_at ?? null, report: s.undo?.report ?? null, statements: s.undo?.sql ? s.undo.sql.split(';\n').length : 0 },
    committed: s.committed, committed_at: s.committed_at ?? null, execution: s.execution ?? null,
  })),
  backends: describeBackends(),
};
mkdirSync('fixtures', { recursive: true });
mkdirSync('console/public/fixtures', { recursive: true });
writeFileSync('fixtures/state-investigating.json', JSON.stringify(state, null, 2));
// Published copy: the console's zero-key replay mode serves /fixtures/*.json from here.
writeFileSync('console/public/fixtures/state-investigating.json', JSON.stringify(state, null, 2));
console.log('fixture written:', state.simulations.length, 'sims —',
  state.simulations[0].tables.slice(0, 3).map((t) => `${t.name}:${t.delta}`).join(' '));
process.exit(0);
