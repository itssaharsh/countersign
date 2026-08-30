// countersign MCP server — streamable HTTP on localhost.
// Register in TrueForge: Settings → Connectors → Add MCP Server → http://localhost:8977/mcp
//
// Tool annotations are load-bearing: TrueForge's default approval policy gates
// ["@write","@destructive"] from these hints, and the agent spec additionally pins
// commit_change/fire_undo by literal name. Read tools are annotated readOnlyHint so
// measurement runs autonomously; only the irreversible acts pause for a human.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { live, shadow, describeBackends } from './db.mjs';
import { simulateChange, simulations, publicView, restoreSimulations } from './simulate.mjs';
import { verifyUndo, commitChange, fireUndo, measureActual, checkDrift, recordPolicy } from './verify.mjs';
import { evaluatePolicy } from './policy.mjs';
import { schemaSql, seedSql } from '../../db/schema.mjs';

const PORT = Number(process.env.COUNTERSIGN_PORT ?? 8977);

function buildServer() {
  const mcp = new McpServer({ name: 'countersign', version: '0.1.0' });

  mcp.registerTool('simulate_change', {
    title: 'Simulate a database change (shadow transaction)',
    description: 'Run the SQL change inside BEGIN..ROLLBACK on the live database. Measures the true blast radius through every foreign key (per-table row deltas, cascade edges), generates an undo script from pre-image snapshots, and fingerprints the target set. Nothing is committed.',
    inputSchema: { change_sql: z.string().describe('The DELETE or ALTER TABLE statement to simulate') },
    annotations: { readOnlyHint: true },
  }, async ({ change_sql }) => {
    const db = await live();
    const result = await simulateChange(db, change_sql);
    return json(result);
  });

  mcp.registerTool('run_investigation', {
    title: 'Run the full Countersign investigation pipeline',
    description: 'One governed call: simulate the change in a shadow transaction (measured blast radius + generated undo + fingerprint), verify the undo against committed shadow state, and evaluate policy deterministically. Returns the three proofs and, when all pass, the undo_token needed for commit_change. Nothing is committed.',
    inputSchema: { change_sql: z.string().describe('The DELETE or ALTER TABLE statement to investigate') },
    annotations: { readOnlyHint: true },
  }, async ({ change_sql }) => {
    const liveDb = await live();
    const sim = await simulateChange(liveDb, change_sql);
    if (sim.error) return json(sim);
    const undoReport = await verifyUndo(await shadow(), sim.simulation_id);
    const rec = simulations.get(sim.simulation_id);
    const verdict = evaluatePolicy({ tables: rec.tables, undo: rec.undo });
    recordPolicy(sim.simulation_id, verdict);
    return json({
      simulation_id: sim.simulation_id,
      blast_radius: sim.tables,
      fingerprint: sim.fingerprint,
      undo: undoReport,
      policy: verdict,
      ready_to_commit: Boolean(undoReport.verified) && verdict.verdict === 'PASS',
      next_step: undoReport.verified && verdict.verdict === 'PASS'
        ? `call commit_change with simulation_id=${sim.simulation_id} and the undo_token`
        : 'blocked — do not call commit_change',
    });
  });

  mcp.registerTool('verify_undo', {
    title: 'Verify the generated undo against committed shadow state',
    description: 'On the shadow database: apply the change and COMMIT it, then apply the generated undo against that committed state and measure whether the exact primary-key set returns. A real test with a real failure mode.',
    inputSchema: { simulation_id: z.string() },
    annotations: { readOnlyHint: true }, // read-only with respect to the LIVE database
  }, async ({ simulation_id }) => json(await verifyUndo(await shadow(), simulation_id)));

  mcp.registerTool('evaluate_policy', {
    title: 'Evaluate policy.yaml (deterministic, no LLM)',
    description: 'Run the deterministic policy engine over the simulation measurement. The verdict is computed by code; a recorded PASS is required before commit_change will execute.',
    inputSchema: { simulation_id: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ simulation_id }) => {
    const sim = simulations.get(simulation_id);
    if (!sim) return json({ error: 'unknown_simulation' });
    const verdict = evaluatePolicy({ tables: sim.tables, undo: sim.undo });
    recordPolicy(simulation_id, verdict);
    return json(verdict);
  });

  mcp.registerTool('fingerprint_target', {
    title: 'Re-fingerprint the target set now',
    description: 'Re-measure the rows the change would affect RIGHT NOW and compare to the fingerprint captured at simulation time. Detects drift between approval and execution.',
    inputSchema: { simulation_id: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ simulation_id }) => {
    const sim = simulations.get(simulation_id);
    if (!sim) return json({ error: 'unknown_simulation' });
    return json(await checkDrift(await live(), sim));
  });

  mcp.registerTool('commit_change', {
    title: 'COMMIT the change to the live database (irreversible)',
    description: 'Execute the approved change for real, scoped to the exact primary keys measured at simulation time. Refuses server-side without: a verified undo token, a recorded policy PASS, and a fingerprint that is still true at commit time.',
    inputSchema: { simulation_id: z.string(), undo_token: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => json(await commitChange(await live(), args)));

  mcp.registerTool('fire_undo', {
    title: 'Fire the verified undo on the live database',
    description: 'After a commit: execute the verified undo script on the live database and re-measure that the approved primary-key set is restored.',
    inputSchema: { simulation_id: z.string(), undo_token: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => json(await fireUndo(await live(), args)));

  mcp.registerTool('measure_actual', {
    title: 'Measure current live state for the receipt',
    description: 'Independent post-hoc measurement: current row counts per affected table, and how many of the approved primary keys are present.',
    inputSchema: { simulation_id: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ simulation_id }) => json(await measureActual(await live(), { simulation_id })));

  mcp.registerTool('list_simulations', {
    title: 'List simulations in this server session',
    description: 'Summaries of all simulations: id, change, verdict, committed state.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => json([...simulations.values()].map((s) => ({
    simulation_id: s.simulation_id, change_sql: s.change_sql, kind: s.kind,
    undo_verified: s.undo?.verified ?? false, policy: s.policy?.verdict ?? null, committed: s.committed,
  }))));

  return mcp;
}

function json(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }

// --- HTTP wiring (stateful streamable HTTP; one transport per MCP session) ---
const transports = new Map();

// Only the local console may call this server from a browser; a wildcard here
// would let any website drive the tools through a visitor's browser (Qodo PR2#4).
// 5199 is the dev server; 5200 is `vite preview`, which serves the production
// bundle and is the build the review tools scan and a judge can run without a
// dev toolchain. Override with COUNTERSIGN_ALLOWED_ORIGINS.
const ALLOWED_ORIGINS = new Set((process.env.COUNTERSIGN_ALLOWED_ORIGINS
  ?? 'http://localhost:5199,http://127.0.0.1:5199,http://localhost:5200,http://127.0.0.1:5200').split(','));

const httpServer = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Last-Event-ID, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.url?.startsWith('/admin/')) {
    // Admin routes rewrite the databases: localhost binding is the outer wall,
    // an optional shared secret is the inner one (Qodo PR3#3).
    const required = process.env.COUNTERSIGN_ADMIN_TOKEN;
    if (required && req.headers['x-admin-token'] !== required) {
      res.writeHead(403).end(JSON.stringify({ error: 'admin token required' }));
      return;
    }
  }
  if (req.url === '/admin/reseed' && req.method === 'POST') {
    // Reset both databases to the deterministic seed — through THIS process's own
    // handles (a second process must never attach to a PGlite dir; that corrupts it).
    try {
      for (const dbp of [live(), shadow()]) {
        const db = await dbp;
        const tables = await db.rows(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
        for (const t of tables) await db.exec(`DROP TABLE IF EXISTS ${t.tablename} CASCADE`);
        for (const q of schemaSql()) await db.exec(q);
        for (const q of seedSql()) await db.exec(q);
      }
      simulations.clear();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ reseeded: true }));
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: String(err.message ?? err) }));
    }
    return;
  }
  if (req.url === '/admin/drift' && req.method === 'POST') {
    // Dev-mode drift injection (PGlite owns the dir, so out-of-band writers route here).
    // In the Postgres demo, drift comes from a genuinely separate process (tools/drift-writer.mjs).
    let body = '';
    for await (const chunk of req) body += chunk;
    let rows = 40;
    try { rows = JSON.parse(body || '{}').rows ?? 40; } catch { /* malformed body defaults to 40 (Qodo PR3#2) */ }
    try {
      const db = await live();
      const maxRow = await db.rows('SELECT coalesce(max(id),0) AS m FROM users');
      const base = Number(maxRow[0].m) + 1;
      const values = Array.from({ length: rows }, (_, i) =>
        `(${base + i},'drift${base + i}@example.test','Drift User','2024-06-15')`).join(',');
      await db.exec(`INSERT INTO users (id,email,full_name,last_active) VALUES ${values}`);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ inserted: rows, first_id: base }));
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: String(err.message ?? err) }));
    }
    return;
  }
  if (req.url === '/state') {
    // Read-only engine truth for the console's evidence panel. No credentials, no SQL.
    const sims = [...simulations.values()].map((s) => ({
      simulation_id: s.simulation_id, change_sql: s.change_sql, kind: s.kind,
      started_at: s.started_at, duration_ms: s.duration_ms,
      tables: s.tables, fingerprint: s.fingerprint ? { ...s.fingerprint } : null,
      // `fired` is the one-shot state. Without it the console cannot tell an armed
      // undo from a spent one, and would keep offering a restore the engine refuses.
      undo: { verified: s.undo?.verified ?? false, verified_at: s.undo?.verified_at ?? null, report: s.undo?.report ?? null, statements: s.undo?.sql ? s.undo.sql.split(';\n').length : 0, fired: s.undo?.fired ?? false },
      policy: s.policy ?? null, committed: s.committed, committed_at: s.committed_at ?? null,
      execution: s.execution ?? null,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ simulations: sims, backends: describeBackends() }));
    return;
  }
  if (!req.url?.startsWith('/mcp')) { res.writeHead(404).end(); return; }
  const sessionId = req.headers['mcp-session-id'];
  try {
    let transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => transports.set(id, transport),
        onsessionclosed: (id) => transports.delete(id),
      });
      await buildServer().connect(transport);
    }
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('mcp request failed:', err);
    if (!res.headersSent) res.writeHead(500).end(JSON.stringify({ error: String(err.message ?? err) }));
  }
});

httpServer.listen(PORT, '127.0.0.1', () => {
  const restored = restoreSimulations();
  console.log(`countersign MCP server on http://127.0.0.1:${PORT}/mcp`);
  console.log('backends:', JSON.stringify(describeBackends()));
  if (restored) console.log(`restored ${restored} persisted simulations (verified undo tokens survive restarts)`);
});
