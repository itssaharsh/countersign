// Undo verification (against COMMITTED state on the shadow DB), the guarded commit,
// and post-commit measurement. The Approve button's three preconditions live here —
// and they are enforced SERVER-SIDE: calling commit_change without them is refused
// no matter what any UI shows.
import { simulations, hashPkSet, hashRowContent, publicView } from './simulate.mjs';

/**
 * verify_undo: on the SHADOW database (same seed as live), apply the change and COMMIT it,
 * then apply the generated undo against that committed state, and measure whether the
 * exact PK set returns. This is a real test with a real failure mode — not a replay
 * inside a still-open transaction. On success the shadow is self-restored by the undo.
 */
export async function verifyUndo(shadowDb, simulationId) {
  const sim = simulations.get(simulationId);
  if (!sim) return { error: 'unknown_simulation' };
  if (sim.kind !== 'destructive-cascade') {
    // No free pass for reversible changes: run the up migration AND the down
    // migration against committed shadow state before calling it verified
    // (Qodo PR1#5/#6).
    let error = null;
    try {
      await shadowDb.withTransaction(async (tx) => { await tx.exec(sim.change_sql); }, { commit: true });
      await shadowDb.withTransaction(async (tx) => { await tx.exec(sim.undo.sql); }, { commit: true });
    } catch (err) {
      error = String(err.message ?? err);
    }
    sim.undo.verified = !error;
    sim.undo.verified_at = new Date().toISOString();
    return error
      ? { verified: false, mode: 'reversible-up-down', undo_error: error, note: 'NOT RESTORED BY THE GENERATED ROLLBACK — the down-migration failed on shadow' }
      : { verified: true, mode: 'reversible-up-down', undo_token: sim.undo.token, note: 'up migration applied and down migration verified on committed shadow state' };
  }
  const pk = sim.fingerprint.pk_column;
  const table = rootTable(sim);
  const preRows = await shadowDb.rows(`SELECT ${pk} AS pk FROM ${table} ORDER BY ${pk}`);
  const preHash = hashPkSet(preRows.map((r) => Number(r.pk)));

  // 1. Apply the destructive change and COMMIT — the world where the mistake shipped.
  await shadowDb.withTransaction(async (tx) => { await tx.exec(sim.change_sql); }, { commit: true });
  const midRows = await shadowDb.rows(`SELECT count(*) AS n FROM ${table}`);

  // 2. Apply the undo against committed state and COMMIT.
  let undoError = null;
  try {
    await shadowDb.withTransaction(async (tx) => { await tx.exec(sim.undo.sql); }, { commit: true });
  } catch (err) {
    undoError = String(err.message ?? err);
  }

  // 3. Measure: did the exact PK set come back — for the root AND every cascade
  //    descendant the simulation snapshotted (Qodo PR1#4)?
  const postRows = await shadowDb.rows(`SELECT ${pk} AS pk FROM ${table} ORDER BY ${pk}`);
  const postHash = hashPkSet(postRows.map((r) => Number(r.pk)));
  const descendantReports = [];
  for (const [cTable, cFp] of Object.entries(sim.fingerprint.cascades ?? {})) {
    const present = await shadowDb.rows(`SELECT count(*) AS n FROM ${cTable}`);
    descendantReports.push({ table: cTable, expected_restored: cFp.count, rows_now: Number(present[0].n) });
  }
  const verified = !undoError && postHash === preHash;
  sim.undo.verified = verified;
  sim.undo.verified_at = new Date().toISOString();
  const report = {
    verified,
    restored_rows: verified ? sim.fingerprint.count : null,
    pk_set_identical: postHash === preHash,
    descendants: descendantReports,
    rows_during_outage: Number(midRows[0].n),
    undo_error: undoError,
    undo_token: verified ? sim.undo.token : null,
    note: verified
      ? `undo replayed against COMMITTED shadow state; ${sim.fingerprint.count}/${sim.fingerprint.count} rows restored, PK set identical`
      : 'NOT RESTORED BY THE GENERATED ROLLBACK — the provided undo does not reconstruct the measured rows',
    shadow_dirty: Boolean(undoError),
  };
  sim.undo.report = report;
  return report;
}

/**
 * Re-measure NOW and compare against everything the human approved: the root PK
 * set, the root rows' content (volatile columns excluded), and each cascade
 * table's affected PK set. Any divergence — added children, edited rows, new or
 * vanished roots — voids the approval (Qodo PR1#1/#2).
 * Accepts an optional tx so the commit path can check inside its own transaction.
 */
export async function checkDrift(liveDb, sim, tx = null) {
  const q = tx ?? liveDb;
  const table = rootTable(sim);
  const pk = sim.fingerprint.pk_column;
  const where = sim.change_sql.match(/WHERE\s+([\s\S]+?);?\s*$/i)?.[1];
  const rows = await q.rows(`SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} ORDER BY ${pk}`);
  const nowPks = rows.map((r) => Number(r[pk]));
  const nowHash = hashPkSet(nowPks);
  const approved = new Set(sim.doomed_pks);
  const added = nowPks.filter((p) => !approved.has(p));
  const current = new Set(nowPks);
  const removed = sim.doomed_pks.filter((p) => !current.has(p));
  const contentHash = hashRowContent(rows, sim.fingerprint.content_columns ?? []);
  const contentFresh = contentHash === sim.fingerprint.content_hash;
  const cascadeDrift = [];
  for (const [cTable, cFp] of Object.entries(sim.fingerprint.cascades ?? {})) {
    if (!cFp.probe_sql) continue;
    const childRows = await q.rows(cFp.probe_sql);
    const childHash = hashPkSet(childRows.map((r) => Number(r.pk)));
    if (childHash !== cFp.pk_hash) {
      cascadeDrift.push({ table: cTable, approved_count: cFp.count, now_count: childRows.length });
    }
  }
  const fresh = nowHash === sim.fingerprint.pk_hash && contentFresh && cascadeDrift.length === 0;
  return { fresh, content_fresh: contentFresh, cascade_drift: cascadeDrift, now_count: nowPks.length, added, removed, now_hash: nowHash };
}

/**
 * commit_change: the gated, irreversible act. Refuses without (a) verified undo token,
 * (b) recorded policy PASS, (c) a fingerprint that is STILL true at commit time.
 * Executes scoped to the captured PK list — never by re-running the predicate — so the
 * human approves exactly the rows they saw, and drift-added rows are reported, not destroyed.
 */
export async function commitChange(liveDb, { simulation_id, undo_token }) {
  const sim = simulations.get(simulation_id);
  if (!sim) return refuse('unknown_simulation');
  if (sim.committed) return refuse('already_committed');
  if (sim.kind === 'destructive-cascade') {
    if (!sim.undo.verified || undo_token !== sim.undo.token) return refuse('undo_not_verified', 'No verified rollback, no commit. Run verify_undo first.');
    if (sim.policy?.verdict !== 'PASS') return refuse('policy_not_passed', `Policy verdict is ${sim.policy?.verdict ?? 'absent'}; a recorded PASS is required.`);
    const pk = sim.fingerprint.pk_column;
    const table = rootTable(sim);
    // Drift check runs INSIDE the same transaction as the delete, so nothing can
    // slip between verification and execution (Qodo PR1#7 / PR2#2).
    const executed = await liveDb.withTransaction(async (tx) => {
      const drift = await checkDrift(liveDb, sim, tx);
      if (!drift.fresh) return { drift };
      const before = await tx.rows(`SELECT count(*) AS n FROM ${table}`);
      for (const batch of chunk(sim.doomed_pks, 5000)) {
        await tx.exec(`DELETE FROM ${table} WHERE ${pk} IN (${batch.join(',')})`);
      }
      const after = await tx.rows(`SELECT count(*) AS n FROM ${table}`);
      return { deleted: Number(before[0].n) - Number(after[0].n) };
    }, { commit: true });
    if (executed.drift) {
      const d = executed.drift;
      const setChanged = d.added.length || d.removed.length;
      const why = [
        setChanged ? `root set +${d.added.length}/-${d.removed.length}` : null,
        // Content-edit wording only when the SET is unchanged — otherwise the set
        // change already explains the content hash difference.
        !setChanged && !d.content_fresh ? 'approved rows were edited' : null,
        d.cascade_drift?.length ? `cascade children changed in ${d.cascade_drift.map((c) => c.table).join(', ')}` : null,
      ].filter(Boolean).join('; ');
      return refuse('fingerprint_drift', `Approval void — ${why}. Nothing was deleted; re-measure.`, { drift: { added: d.added.slice(0, 20), removed: d.removed.slice(0, 20), cascade_drift: d.cascade_drift, content_fresh: d.content_fresh, now_count: d.now_count } });
    }
    sim.committed = true;
    sim.committed_at = new Date().toISOString();
    sim.execution = { scoped_to_pks: sim.doomed_pks.length, deleted_root_rows: executed.deleted };
    return { committed: true, scoped_to: sim.doomed_pks.length, deleted_root_rows: executed.deleted, receipt_ready: true };
  }
  // Reversible change: the same three gates apply — verified down-migration,
  //  policy PASS, and the matching token (Qodo PR1#5, PR3#1).
  if (!sim.undo.verified || undo_token !== sim.undo.token) return refuse('undo_not_verified', 'The down-migration has not been verified on shadow. Run verify_undo first.');
  if (sim.policy?.verdict !== 'PASS') return refuse('policy_not_passed', `Policy verdict is ${sim.policy?.verdict ?? 'absent'}; a recorded PASS is required.`);
  await liveDb.withTransaction(async (tx) => { await tx.exec(sim.change_sql); }, { commit: true });
  sim.committed = true;
  sim.committed_at = new Date().toISOString();
  return { committed: true, kind: 'reversible' };
}

/** fire_undo: execute the verified undo on LIVE after a commit. The finale. */
export async function fireUndo(liveDb, { simulation_id, undo_token }) {
  const sim = simulations.get(simulation_id);
  if (!sim) return refuse('unknown_simulation');
  if (!sim.committed) return refuse('nothing_to_undo', 'commit_change has not executed for this simulation.');
  if (sim.undo.fired) return refuse('undo_already_fired', 'This undo has already been executed; replaying it would duplicate rows.');
  if (!sim.undo.verified || undo_token !== sim.undo.token) return refuse('undo_not_verified');
  await liveDb.withTransaction(async (tx) => { await tx.exec(sim.undo.sql); }, { commit: true });
  sim.undo.fired = true;
  sim.undo.fired_at = new Date().toISOString();
  const actual = await measureActual(liveDb, { simulation_id });
  return { undone: true, post_undo: actual };
}

/** measure_actual: independent post-hoc measurement for the receipt. */
export async function measureActual(liveDb, { simulation_id }) {
  const sim = simulations.get(simulation_id);
  if (!sim) return refuse('unknown_simulation');
  const out = [];
  for (const t of sim.tables) {
    const r = await liveDb.rows(`SELECT count(*) AS n FROM ${t.name}`);
    out.push({ table: t.name, rows_now: Number(r[0].n) });
  }
  if (sim.kind === 'destructive-cascade') {
    const pk = sim.fingerprint.pk_column;
    const table = rootTable(sim);
    let present = 0;
    for (const batch of chunk(sim.doomed_pks, 5000)) {
      const r = await liveDb.rows(`SELECT count(*) AS n FROM ${table} WHERE ${pk} IN (${batch.join(',')})`);
      present += Number(r[0].n);
    }
    out.push({ table: `${table} (approved set present)`, rows_now: present });
  }
  return { simulation_id, measured_at: new Date().toISOString(), tables: out };
}

export function recordPolicy(simulationId, verdict) {
  const sim = simulations.get(simulationId);
  if (sim) sim.policy = verdict;
}

function rootTable(sim) { return sim.change_sql.match(/(?:DELETE\s+FROM|ALTER\s+TABLE)\s+([a-z_][a-z0-9_]*)/i)[1].toLowerCase(); }
function refuse(code, message, extra = {}) { return { refused: true, code, message: message ?? code, ...extra }; }
function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }
export { publicView };
