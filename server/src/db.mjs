// Database access for the countersign server.
// LIVE  = the database the destructive change ultimately targets.
// SHADOW = a disposable copy where undo scripts are verified against COMMITTED state.
// Each resolves to either a real Postgres URL (LIVE_DATABASE_URL / SHADOW_DATABASE_URL)
// or a local PGlite data dir (dev default). Credentials never leave this process.
import { mkdirSync } from 'node:fs';

const PGLITE_LIVE = process.env.PGLITE_LIVE_DIR ?? new URL('../../pglite-data/live', import.meta.url).pathname;
const PGLITE_SHADOW = process.env.PGLITE_SHADOW_DIR ?? new URL('../../pglite-data/shadow', import.meta.url).pathname;

class PgliteHandle {
  constructor(dir) { this.dir = dir; this.db = null; this._chain = Promise.resolve(); }
  async init() {
    const { PGlite } = await import('@electric-sql/pglite');
    mkdirSync(this.dir, { recursive: true });
    this.db = new PGlite(this.dir);
    await this.db.waitReady;
    return this;
  }
  /** Run a single statement (or several separated by ;) outside any held transaction. */
  async exec(sql) { return this.db.exec(sql); }
  /** Parameterless query returning rows. */
  async rows(sql) {
    const res = await this.db.query(sql);
    return res.rows;
  }
  /**
   * Run fn within BEGIN..ROLLBACK/COMMIT on the single PGlite session.
   * Serialized: concurrent MCP calls queue instead of interleaving statements
   * into each other's transactions (Qodo PR1 finding 8 / PR2 finding 3).
   */
  withTransaction(fn, { commit = false } = {}) {
    const run = async () => {
      await this.db.exec('BEGIN');
      try {
        const out = await fn({ rows: (q) => this.rows(q), exec: (q) => this.exec(q) });
        await this.db.exec(commit ? 'COMMIT' : 'ROLLBACK');
        return out;
      } catch (err) {
        await this.db.exec('ROLLBACK').catch(() => {});
        throw err;
      }
    };
    const next = this._chain.then(run, run);
    this._chain = next.catch(() => {});
    return next;
  }
  async close() { await this.db?.close(); }
}

class PostgresHandle {
  constructor(url) { this.url = url; this.sql = null; this._chain = Promise.resolve(); }
  async init() {
    const { default: postgres } = await import('postgres');
    // max 1: simulations depend on statement ordering within one session.
    this.sql = postgres(this.url, { max: 1, prepare: false });
    return this;
  }
  async exec(sql) { return this.sql.unsafe(sql); }
  async rows(sql) { return await this.sql.unsafe(sql); }
  withTransaction(fn, { commit = false } = {}) {
    const run = async () => {
      await this.sql.unsafe('BEGIN');
      try {
        const out = await fn({ rows: (q) => this.rows(q), exec: (q) => this.exec(q) });
        await this.sql.unsafe(commit ? 'COMMIT' : 'ROLLBACK');
        return out;
      } catch (err) {
        await this.sql.unsafe('ROLLBACK').catch(() => {});
        throw err;
      }
    };
    const next = this._chain.then(run, run);
    this._chain = next.catch(() => {});
    return next;
  }
  async close() { await this.sql?.end(); }
}

async function open(urlEnv, pgliteDir) {
  const url = process.env[urlEnv];
  return url ? new PostgresHandle(url).init() : new PgliteHandle(pgliteDir).init();
}

let liveP = null, shadowP = null;
export function live() { return (liveP ??= open('LIVE_DATABASE_URL', PGLITE_LIVE)); }
export function shadow() { return (shadowP ??= open('SHADOW_DATABASE_URL', PGLITE_SHADOW)); }
export function describeBackends() {
  return {
    live: process.env.LIVE_DATABASE_URL ? 'postgres (url redacted)' : `pglite:${PGLITE_LIVE}`,
    shadow: process.env.SHADOW_DATABASE_URL ? 'postgres (url redacted)' : `pglite:${PGLITE_SHADOW}`,
  };
}
