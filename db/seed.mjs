// Seed either a PGlite data dir (default, dev/shadow) or a real Postgres URL (live demo).
//   node db/seed.mjs                          → PGlite at ./pglite-data/live
//   node db/seed.mjs --dir ./pglite-data/shadow
//   DATABASE_URL=postgres://... node db/seed.mjs --pg
import { schemaSql, seedSql } from './schema.mjs';
// corruption guard: a PGlite data dir must have exactly one attached process.
// Only the server-owned default dirs are protected; explicit --dir targets are the caller's.
const guardExempt = process.argv.includes('--dir') && !process.argv[process.argv.indexOf('--dir') + 1]?.includes('pglite-data/');
if (!guardExempt) {
  try {
    const r = await fetch('http://127.0.0.1:8977/state', { signal: AbortSignal.timeout(1500) });
    if (r.ok && !process.argv.includes('--force')) {
      console.error('REFUSED: countersign server is running and owns the PGlite dirs. Use POST /admin/reseed, or stop the server first.');
      process.exit(2);
    }
  } catch { /* server down — safe to proceed */ }
}


const args = process.argv.slice(2);
const usePg = args.includes('--pg');
const dirIdx = args.indexOf('--dir');
const dataDir = dirIdx >= 0 ? args[dirIdx + 1] : './pglite-data/live';

async function main() {
  let exec, close;
  if (usePg) {
    const { default: postgres } = await import('postgres');
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL required with --pg');
    const sql = postgres(url, { max: 1 });
    exec = (q) => sql.unsafe(q);
    close = () => sql.end();
    console.log('Seeding Postgres at', url.replace(/:[^:@/]+@/, ':***@'));
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    exec = (q) => db.exec(q);
    close = () => db.close();
    console.log('Seeding PGlite at', dataDir);
  }
  const t0 = Date.now();
  // --reset drops the public schema first. Never implicit: this points at whatever
  // database the URL names, and a seed script that quietly drops tables is a worse
  // hazard than the one this project exists to prevent.
  if (args.includes('--reset')) {
    console.log('resetting public schema');
    await exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  for (const s of schemaSql()) await exec(s);
  for (const s of seedSql()) await exec(s);
  const counts = await exec(`SELECT
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM users WHERE last_active < '2025-01-01') AS doomed_users,
    (SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id WHERE u.last_active < '2025-01-01') AS doomed_orders,
    (SELECT count(*) FROM payments p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=o.user_id WHERE u.last_active < '2025-01-01') AS doomed_payments`);
  // PGlite returns [{rows:[…]}] per statement; the postgres driver returns the rows
  // directly. Read whichever shape came back rather than assuming the local one.
  const row = Array.isArray(counts)
    ? (counts[counts.length - 1]?.rows?.[0] ?? counts[0])
    : (counts.rows?.[0] ?? counts[0]);
  console.log('Seeded in', ((Date.now() - t0) / 1000).toFixed(1) + 's —', JSON.stringify(row));
  await close();
}
main().catch((e) => { console.error(e); process.exit(1); });
