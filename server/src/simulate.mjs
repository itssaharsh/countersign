// The shadow-execution engine. Everything Countersign later *claims* is measured here,
// inside BEGIN..ROLLBACK on the live database, before any Approve button can exist.
//
// Scope (stated honestly, also printed on the dossier):
// - DELETE FROM <table> [WHERE <predicate>]  — full cascade measurement + verified row undo
// - ALTER TABLE <table> ADD COLUMN ...       — reversible control case (auto down-migration)
// Tables are assumed to have a single-column integer primary key `id` (true of this estate;
// the PK column is still read from the catalog, not assumed silently).
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fkEdges, reachableFrom } from './fkgraph.mjs';

const EVIDENCE_DIR = new URL('../../evidence', import.meta.url).pathname;
/** Volatile columns excluded from fingerprints so timestamps don't fake drift. */
const VOLATILE_COLUMNS = new Set(['updated_at', 'last_seen', 'created_at', 'placed_at', 'at']);

const DELETE_RE = /^\s*DELETE\s+FROM\s+([a-z_][a-z0-9_]*)\s*(?:WHERE\s+([\s\S]+?))?\s*;?\s*$/i;
const ADD_COL_RE = /^\s*ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+([\s\S]+?)\s*;?\s*$/i;

export const simulations = new Map(); // simulation_id -> record

export function classifyChange(changeSql) {
  const del = DELETE_RE.exec(changeSql);
  if (del) return { kind: 'delete', table: del[1].toLowerCase(), predicate: del[2]?.trim() ?? null };
  const add = ADD_COL_RE.exec(changeSql);
  if (add) return { kind: 'add_column', table: add[1].toLowerCase(), column: add[2].toLowerCase(), typeExpr: add[3].trim() };
  return { kind: 'unsupported' };
}

async function pkColumn(db, table) {
  const rows = await db.rows(`
    SELECT a.attname AS pk
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'public.${table}'::regclass AND i.indisprimary`);
  if (rows.length !== 1) throw new Error(`table ${table}: expected single-column primary key, found ${rows.length}`);
  return rows[0].pk;
}

async function columnNames(db, table) {
  const rows = await db.rows(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position`);
  return rows.map((r) => r.column_name);
}

export function hashPkSet(pks) {
  const h = createHash('sha256');
  for (const pk of [...pks].sort((a, b) => a - b)) h.update(String(pk) + '\n');
  return h.digest('hex');
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Simulate a change on the live DB inside a rolled-back transaction. */
export async function simulateChange(db, changeSql, { onProgress = () => {} } = {}) {
  const change = classifyChange(changeSql);
  if (change.kind === 'unsupported') {
    return { error: 'unsupported_change', supported: ['DELETE FROM <table> [WHERE ...]', 'ALTER TABLE <table> ADD COLUMN ...'] };
  }
  const id = randomUUID().slice(0, 8);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  if (change.kind === 'add_column') {
    const undoSql = `ALTER TABLE ${change.table} DROP COLUMN ${change.column}`;
    await db.withTransaction(async (tx) => {
      await tx.exec(changeSql);
      const cols = await columnNames(tx.rows ? { rows: tx.rows } : db, change.table);
      if (!cols.includes(change.column)) throw new Error('column not present after ADD COLUMN in shadow tx');
    });
    const record = {
      simulation_id: id, change_sql: changeSql, kind: 'reversible',
      verdict: 'REVERSIBLE — additive change; auto down-migration drops the new column',
      tables: [{ name: change.table, delta: 0, edge: null, note: `+ column ${change.column}` }],
      undo: { sql: undoSql, verified: false, token: null },
      fingerprint: null, duration_ms: Date.now() - t0, started_at: startedAt, committed: false,
    };
    simulations.set(id, record);
    persist(record);
    return record;
  }

  // DELETE path — the hero measurement.
  const pk = await pkColumn(db, change.table);
  const edges = await fkEdges(db);
  const hops = reachableFrom(change.table, edges);
  const where = change.predicate ? `WHERE ${change.predicate}` : '';
  onProgress({ stage: 'graph', hops: hops.length });

  const result = await db.withTransaction(async (tx) => {
    // 1. Capture the doomed root PK set (the fingerprint's subject).
    const doomedRows = await tx.rows(`SELECT ${pk} AS pk FROM ${change.table} ${where} ORDER BY ${pk}`);
    const doomedPks = doomedRows.map((r) => Number(r.pk));
    onProgress({ stage: 'root', table: change.table, count: doomedPks.length });

    // 2. Per reachable table: measure counts and snapshot rows (for undo) BEFORE deleting.
    //    Build the join path root -> ... -> table along CASCADE edges only.
    const joinPathTo = buildJoinPaths(change.table, hops);
    const tables = [{ name: change.table, delta: doomedPks.length, edge: null, onDelete: null }];
    const snapshots = new Map();
    snapshots.set(change.table, await tx.rows(`SELECT * FROM ${change.table} ${where} ORDER BY ${pk}`));
    for (const [table, path] of joinPathTo) {
      const joins = path.map((e, i) => {
        const parentAlias = i === 0 ? 't0' : `t${i}`;
        return `JOIN ${e.child} t${i + 1} ON t${i + 1}.${e.childColumn} = ${parentAlias}.id`;
      }).join(' ');
      const last = `t${path.length}`;
      const kind = path[path.length - 1].onDelete;
      const cntRows = await tx.rows(`SELECT count(*) AS n FROM ${change.table} t0 ${joins} ${where ? `WHERE ${qualify(change.predicate, 't0')}` : ''}`);
      const n = Number(cntRows[0].n);
      tables.push({ name: table, delta: kind === 'CASCADE' ? n : 0, affected: n, edge: path.map((e) => e.constraint).join('→'), onDelete: kind });
      if (kind === 'CASCADE' && n > 0) {
        snapshots.set(table, await tx.rows(`SELECT ${last}.* FROM ${change.table} t0 ${joins} ${where ? `WHERE ${qualify(change.predicate, 't0')}` : ''} ORDER BY ${last}.id`));
      }
      onProgress({ stage: 'measure', table, count: n, onDelete: kind });
    }

    // 3. Execute the real statement and measure actual per-table deltas.
    const before = await tableCounts(tx, tables.map((t) => t.name));
    await tx.exec(changeSql);
    const after = await tableCounts(tx, tables.map((t) => t.name));
    for (const t of tables) {
      const measured = before.get(t.name) - after.get(t.name);
      t.measured_delta = measured;
      if (t.onDelete === 'CASCADE' || t.edge === null) t.delta = measured; // trust execution over prediction
    }

    // 4. Generate undo INSERTs from snapshots, parents before children.
    const undoStmts = [];
    for (const [table, rows] of snapshots) {
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      for (const batch of chunk(rows, 500)) {
        const values = batch.map((r) => `(${cols.map((c) => sqlLiteral(r[c])).join(',')})`).join(',');
        undoStmts.push(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values}`);
      }
    }
    const undoSql = undoStmts.join(';\n');

    // 5. Fingerprint the target set as measured.
    const fingerprint = { count: doomedPks.length, pk_hash: hashPkSet(doomedPks), pk_column: pk, measured_at: new Date().toISOString(), excluded_volatile_columns: [...VOLATILE_COLUMNS] };
    return { doomedPks, tables, undoSql, fingerprint };
  }); // ROLLBACK — nothing happened to the live database.

  const undoToken = randomUUID();
  const record = {
    simulation_id: id, change_sql: changeSql, kind: 'destructive-cascade',
    verdict: null, // set after verify_undo + policy
    tables: result.tables,
    doomed_pks: result.doomedPks,
    undo: { sql: result.undoSql, verified: false, token: undoToken },
    fingerprint: result.fingerprint,
    duration_ms: Date.now() - t0, started_at: startedAt, committed: false,
    policy: null,
  };
  simulations.set(id, record);
  persist(record);
  return publicView(record);
}

function buildJoinPaths(root, hops) {
  // Map table -> path of edges from root, following the hop list (BFS ordered).
  const paths = new Map();
  for (const e of hops) {
    if (e.parent === root) { if (!paths.has(e.child)) paths.set(e.child, [e]); continue; }
    const parentPath = paths.get(e.parent);
    if (parentPath && !paths.has(e.child)) paths.set(e.child, [...parentPath, e]);
  }
  return paths;
}

function qualify(predicate, alias) {
  // Qualify bare column refs in simple predicates (col op value). Conservative: only
  // qualifies the leading identifier of each AND/OR clause. Documented limitation.
  return predicate.replace(/(^|\s(?:AND|OR)\s)\s*([a-z_][a-z0-9_]*)/gi, (m, pre, col) => `${pre}${alias}.${col}`);
}

async function tableCounts(tx, names) {
  const out = new Map();
  for (const n of names) {
    const r = await tx.rows(`SELECT count(*) AS n FROM ${n}`);
    out.set(n, Number(r[0].n));
  }
  return out;
}

function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }

export function publicView(record) {
  // The model gets the measurement, never the bulk artifacts (undo SQL stays server-side;
  // doomed PK list is summarized). Full artifacts are written to the evidence dir.
  const { undo, doomed_pks, ...rest } = record;
  return {
    ...rest,
    doomed_pk_sample: doomed_pks ? doomed_pks.slice(0, 5) : undefined,
    undo: { verified: undo.verified, token: undo.token, statements: undo.sql ? undo.sql.split(';\n').length : 0 },
  };
}

function persist(record) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(`${EVIDENCE_DIR}/sim_${record.simulation_id}.json`, JSON.stringify(record, (k, v) => (k === 'sql' && typeof v === 'string' && v.length > 2000 ? v.slice(0, 2000) + '…' : v), 2));
  if (record.undo?.sql) writeFileSync(`${EVIDENCE_DIR}/undo_${record.simulation_id}.sql`, record.undo.sql);
}
