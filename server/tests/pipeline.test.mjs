// End-to-end engine test: every claim the demo makes, asserted here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { live, shadow } from '../src/db.mjs';
import { simulateChange, simulations } from '../src/simulate.mjs';
import { verifyUndo, commitChange, fireUndo, measureActual, checkDrift, recordPolicy } from '../src/verify.mjs';
import { evaluatePolicy } from '../src/policy.mjs';

const CHANGE = "DELETE FROM users WHERE last_active < '2025-01-01'";

test('full countersign pipeline', async (t) => {
  const liveDb = await live();
  const shadowDb = await shadow();

  let sim;
  await t.test('simulate measures the cascade and rolls back', async () => {
    const before = await liveDb.rows('SELECT count(*) AS n FROM users');
    sim = await simulateChange(liveDb, CHANGE);
    const after = await liveDb.rows('SELECT count(*) AS n FROM users');
    assert.equal(Number(before[0].n), Number(after[0].n), 'live db must be untouched after simulate');
    const users = sim.tables.find((x) => x.name === 'users');
    const orders = sim.tables.find((x) => x.name === 'orders');
    const payments = sim.tables.find((x) => x.name === 'payments');
    assert.equal(users.delta, 6000);
    assert.equal(orders.delta, 17971);
    assert.equal(payments.delta, 19442);
    assert.ok(sim.fingerprint.pk_hash.length === 64);
    const tickets = sim.tables.find((x) => x.name === 'support_tickets');
    assert.equal(tickets.onDelete, 'SET NULL');
    assert.equal(tickets.delta, 0, 'SET NULL edges lose no rows');
  });

  await t.test('commit refuses without verified undo', async () => {
    const r = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: 'wrong' });
    assert.equal(r.refused, true);
    assert.equal(r.code, 'undo_not_verified');
  });

  let undoReport;
  await t.test('undo verifies against committed shadow state', async () => {
    undoReport = await verifyUndo(shadowDb, sim.simulation_id);
    assert.equal(undoReport.verified, true, JSON.stringify(undoReport));
    assert.equal(undoReport.pk_set_identical, true);
    assert.equal(undoReport.restored_rows, 6000);
  });

  await t.test('commit refuses without policy PASS', async () => {
    const r = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(r.refused, true);
    assert.equal(r.code, 'policy_not_passed');
  });

  await t.test('policy engine passes this change deterministically', async () => {
    const record = simulations.get(sim.simulation_id);
    const verdict = evaluatePolicy({ tables: record.tables, undo: record.undo });
    assert.equal(verdict.verdict, 'PASS', JSON.stringify(verdict.rules));
    recordPolicy(sim.simulation_id, verdict);
  });

  await t.test('drift voids the approval; re-measure re-arms it', async () => {
    await liveDb.exec("INSERT INTO users (id,email,full_name,last_active) VALUES (990001,'drift@example.test','Drift User','2024-06-01')");
    const drift = await checkDrift(liveDb, simulations.get(sim.simulation_id));
    assert.equal(drift.fresh, false);
    assert.deepEqual(drift.added, [990001]);
    const refused = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(refused.refused, true);
    assert.equal(refused.code, 'fingerprint_drift');
    // The drift row is REPORTED, not silently destroyed — remove it and proceed.
    await liveDb.exec('DELETE FROM users WHERE id = 990001');
  });

  await t.test('scoped commit deletes exactly the approved set', async () => {
    const r = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(r.committed, true, JSON.stringify(r));
    assert.equal(r.deleted_root_rows, 6000);
    const now = await liveDb.rows('SELECT count(*) AS n FROM users');
    assert.equal(Number(now[0].n), 12000);
  });

  await t.test('fire_undo restores the exact PK set on live', async () => {
    const r = await fireUndo(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(r.undone, true, JSON.stringify(r));
    const now = await liveDb.rows('SELECT count(*) AS n FROM users');
    assert.equal(Number(now[0].n), 18000);
    const present = r.post_undo.tables.find((x) => x.table.includes('approved set present'));
    assert.equal(present.rows_now, 6000, 'every approved row is back');
  });

  await t.test('reversible control case: small gate, auto down-migration', async () => {
    const ctl = await simulateChange(liveDb, 'ALTER TABLE users ADD COLUMN marketing_opt_out boolean NOT NULL DEFAULT false');
    assert.equal(ctl.kind, 'reversible');
    const vu = await verifyUndo(shadowDb, ctl.simulation_id);
    assert.equal(vu.verified, true);
  });
});
