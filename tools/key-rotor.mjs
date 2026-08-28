// Key rotor: a local pass-through to Groq's OpenAI-compatible API that fails over
// between two API keys on rate/quota errors (429/402/413) and flips the primary
// so subsequent calls start from the healthy key. Keys come from .env (gitignored)
// or the environment — they never enter TrueForge, the repo, or model context.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = Number(process.env.KEY_ROTOR_PORT ?? 8991);
const UPSTREAM = process.env.KEY_ROTOR_UPSTREAM ?? 'https://api.groq.com/openai';

function loadEnvFile() {
  const p = new URL('../.env', import.meta.url).pathname;
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, 'utf8').split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.+)$/)).filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
}
const env = { ...loadEnvFile(), ...process.env };
let keys = [env.GROQ_KEY_A, env.GROQ_KEY_B, env.GROQ_KEY_C].filter(Boolean);
if (!keys.length) { console.error('no GROQ_KEY_A/GROQ_KEY_B configured'); process.exit(2); }

const FAILOVER_STATUS = new Set([401, 402, 413, 429]);

const server = createServer(async (req, res) => {
  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
    // Compatibility shim: TrueForge echoes assistant `reasoning_content` back in
    // history; Groq's API rejects unknown assistant properties. Strip it (and the
    // sibling `reasoning`) — no behavioral change, it is an output-only echo.
    if (req.url?.includes('/chat/completions')) {
      try {
        const parsed = JSON.parse(body.toString('utf8'));
        for (const m of parsed.messages ?? []) {
          delete m.reasoning_content;
          delete m.reasoning;
        }
        body = Buffer.from(JSON.stringify(parsed));
      } catch { /* forward as-is */ }
    }
  }
  const url = UPSTREAM + req.url;
  // Up to 3 cycles over the key ring; when a whole cycle throttles, wait out the
  // per-minute window before the next cycle instead of failing the turn.
  const MAX_CYCLES = 3;
  let lastThrottled = null;
  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    if (cycle > 0) { console.log(`all keys throttled; waiting 20s (cycle ${cycle + 1}/${MAX_CYCLES})`); await new Promise((r) => setTimeout(r, 20000)); }
    // Snapshot the ring per request: concurrent requests may promote keys mid-flight
    // (Qodo PR7#2) — each request walks its own consistent order.
    const ring = [...keys];
    for (let attempt = 0; attempt < ring.length; attempt++) {
      const key = ring[attempt];
      let upstream;
      try {
        upstream = await fetch(url, {
          method: req.method,
          headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json', Authorization: `Bearer ${key}` },
          body,
          signal: AbortSignal.timeout(120000), // a hung upstream must not block failover (Qodo PR7#5)
        });
      } catch (err) {
        console.error(`upstream error (key ${attempt + 1}):`, String(err.message ?? err).slice(0, 120));
        continue;
      }
      if (FAILOVER_STATUS.has(upstream.status)) {
        // Every throttled key — including the last one — yields to the next key or
        // the next cycle; only after all cycles do we forward the failure (Qodo PR7#1).
        console.log(`key ${attempt + 1} -> ${upstream.status}; failing over`);
        lastThrottled = upstream;
        continue;
      }
      if (key !== keys[0]) {
        const i = keys.indexOf(key);
        if (i > 0) { keys = [...keys.slice(i), ...keys.slice(0, i)]; console.log('promoted healthy key to primary'); }
      }
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
      if (upstream.body) {
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
      return;
    }
  }
  if (lastThrottled) {
    res.writeHead(lastThrottled.status, { 'Content-Type': lastThrottled.headers.get('content-type') ?? 'application/json' });
    res.end(await lastThrottled.text().catch(() => ''));
    return;
  }
  res.writeHead(502).end(JSON.stringify({ error: 'all keys failed after retries' }));
});

server.listen(PORT, '127.0.0.1', () => console.log(`key-rotor -> ${UPSTREAM} on http://127.0.0.1:${PORT} (${keys.length} keys)`));
