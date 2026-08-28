// Demo choreography: the "coworker" who writes rows while an approval is armed —
// via the server's own MCP surface? No: drift must be an OUT-OF-BAND write. It talks
// straight to the database like any other application would. Refuses to run against
// PGlite while the server owns the dir (single-attach rule) — in PGlite dev mode use
// --via-server which routes through a debug insert endpoint instead.
const VIA = process.argv.includes('--via-server');
const N = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 40);
if (VIA) {
  const res = await fetch('http://127.0.0.1:8977/admin/drift', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: N }),
  });
  console.log(await res.text());
} else {
  const url = process.env.LIVE_DATABASE_URL;
  if (!url) { console.error('LIVE_DATABASE_URL required (or use --via-server in PGlite dev mode)'); process.exit(2); }
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1 });
  const base = 900000 + Math.floor(Math.random() * 50000);
  for (let i = 0; i < N; i++) {
    await sql.unsafe(`INSERT INTO users (id,email,full_name,last_active) VALUES (${base + i},'drift${base + i}@example.test','Drift User','2024-06-15')`);
  }
  console.log(`inserted ${N} drift rows matching the doomed predicate`);
  await sql.end();
}
process.exit(0);
