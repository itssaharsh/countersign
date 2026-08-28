// End-to-end engine test: every claim the demo makes, asserted here first.
// Runs against TEST-SCOPED PGlite dirs so it is safe while the server is up.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'countersign-test-'));
process.env.PGLITE_LIVE_DIR = join(scratch, 'live');
process.env.PGLITE_SHADOW_DIR = join(scratch, 'shadow');

const { live, shadow } = await import('../src/db.mjs');
const { simulateChange, simulations, classifyChange, isSingleStatement } = await import('../src/simulate.mjs');
const { verifyUndo, commitChange, fireUndo, measureActual, checkDrift, recordPolicy } = await import('../src/verify.mjs');
const { evaluatePolicy } = await import('../src/policy.mjs');
const { schemaSql, seedSql } = await import('../../db/schema.mjs');

const CHANGE = "DELETE FROM users WHERE last_active < '2025-01-01'";

before(async () => {
  for (const dbp of [live(), shadow()]) {
    const db = await dbp;
    for (const q of schemaSql()) await db.exec(q);
    for (const q of seedSql()) await db.exec(q);
  }
}, { timeout: 120000 });

test('full countersign pipeline', { timeout: 300000 }, async (t) => {
  const liveDb = await live();
  const shadowDb = await shadow();

  await t.test('multi-statement SQL is rejected', () => {
    assert.equal(isSingleStatement("DELETE FROM users WHERE id = 1; DROP TABLE users"), false);
    assert.equal(isSingleStatement("DELETE FROM users WHERE note = 'a;b'"), true);
    assert.equal(classifyChange("DELETE FROM users WHERE id=1; DROP TABLE users").kind, 'unsupported');
  });

  let sim;
  await t.test('simulate measures the cascade and rolls back', async () => {
    const before = await liveDb.rows('SELECT count(*) AS n FROM users');
    sim = await simulateChange(liveDb, CHANGE);
    const after = await liveDb.rows('SELECT count(*) AS n FROM users');
    assert.equal(Number(before[0].n), Number(after[0].n), 'live db must be untouched after simulate');
    assert.equal(sim.tables.find((x) => x.name === 'users').delta, 6000);
    assert.equal(sim.tables.find((x) => x.name === 'orders').delta, 17971);
    assert.equal(sim.tables.find((x) => x.name === 'payments').delta, 19442);
    assert.ok(sim.fingerprint.content_hash?.length === 64, 'root content is fingerprinted');
    assert.ok(sim.fingerprint.cascades.orders?.pk_hash, 'cascade children are fingerprinted');
  });

  let undoReport;
  await t.test('undo verifies against committed shadow state (incl. descendants)', async () => {
    undoReport = await verifyUndo(shadowDb, sim.simulation_id);
    assert.equal(undoReport.verified, true, JSON.stringify(undoReport));
    assert.equal(undoReport.restored_rows, 6000);
    assert.ok(Array.isArray(undoReport.descendants) && undoReport.descendants.length >= 2);
  });

  await t.test('policy passes deterministically', async () => {
    const record = simulations.get(sim.simulation_id);
    const verdict = evaluatePolicy({ tables: record.tables, undo: record.undo });
    assert.equal(verdict.verdict, 'PASS');
    recordPolicy(sim.simulation_id, verdict);
  });

  await t.test('CHILD drift voids the approval (new order under a doomed user)', async () => {
    await liveDb.exec("INSERT INTO orders (id,user_id,total_cents,status) VALUES (990001, 5, 999, 'complete')");
    const refused = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(refused.refused, true);
    assert.equal(refused.code, 'fingerprint_drift');
    assert.ok(refused.drift.cascade_drift.some((c) => c.table === 'orders'), JSON.stringify(refused.drift));
    await liveDb.exec('DELETE FROM orders WHERE id = 990001');
  });

  await t.test('CONTENT drift voids the approval (edited doomed row)', async () => {
    await liveDb.exec("UPDATE users SET email = 'edited@example.test' WHERE id = 5");
    const refused = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(refused.refused, true);
    assert.equal(refused.code, 'fingerprint_drift');
    assert.equal(refused.drift.content_fresh, false);
    await liveDb.exec("UPDATE users SET email = 'u5@example.test' WHERE id = 5");
  });

  await t.test('scoped commit deletes exactly the approved set', async () => {
    const r = await commitChange(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(r.committed, true, JSON.stringify(r));
    assert.equal(r.deleted_root_rows, 6000);
    const nulled = await liveDb.rows('SELECT count(*) AS n FROM support_tickets WHERE user_id IS NULL');
    assert.ok(Number(nulled[0].n) > 0, 'SET NULL edge nulled some references');
  });

  await t.test('fire_undo restores rows AND nulled relationships', async () => {
    const preNull = await liveDb.rows('SELECT count(*) AS n FROM support_tickets WHERE user_id IS NULL');
    const r = await fireUndo(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(r.undone, true, JSON.stringify(r));
    const users = await liveDb.rows('SELECT count(*) AS n FROM users');
    assert.equal(Number(users[0].n), 18000);
    const postNull = await liveDb.rows('SELECT count(*) AS n FROM support_tickets WHERE user_id IS NULL');
    assert.ok(Number(postNull[0].n) < Number(preNull[0].n), `nulled refs restored: ${preNull[0].n} -> ${postNull[0].n}`);
    const present = r.post_undo.tables.find((x) => x.table.includes('approved set present'));
    assert.equal(present.rows_now, 6000);
  });

  await t.test('undo is one-shot', async () => {
    const again = await fireUndo(liveDb, { simulation_id: sim.simulation_id, undo_token: undoReport.undo_token });
    assert.equal(again.refused, true);
    assert.equal(again.code, 'undo_already_fired');
  });

  await t.test('reversible path: gated like everything else', async () => {
    const ctl = await simulateChange(liveDb, 'ALTER TABLE users ADD COLUMN marketing_opt_out boolean NOT NULL DEFAULT false');
    assert.equal(ctl.kind, 'reversible');
    // commit refused before verification
    const early = await commitChange(liveDb, { simulation_id: ctl.simulation_id, undo_token: simulations.get(ctl.simulation_id).undo.token });
    assert.equal(early.refused, true);
    assert.equal(early.code, 'undo_not_verified');
    const vu = await verifyUndo(shadowDb, ctl.simulation_id);
    assert.equal(vu.verified, true, JSON.stringify(vu));
    assert.equal(vu.mode, 'reversible-up-down');
    const rec = simulations.get(ctl.simulation_id);
    recordPolicy(ctl.simulation_id, evaluatePolicy({ tables: rec.tables, undo: rec.undo }));
    const r = await commitChange(liveDb, { simulation_id: ctl.simulation_id, undo_token: rec.undo.token });
    assert.equal(r.committed, true, JSON.stringify(r));
  });
});
