// Credential scan that reads what a viewer would read, not what a field-level
// grep can see.
//
// A recorded stream carries the model's prose in fragments: a token written into
// an assistant message is spelled across dozens of content deltas, so it exists in
// the rendered transcript but in no single line of the file. Scanning fields, or
// grepping lines, reports clean on a fixture that leaks. This reassembles every
// stream the way the console's reducer does and scans the reconstruction.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const PATTERNS = [
  { name: 'groq key', re: /gsk_[A-Za-z0-9]{20,}/g },
  { name: 'openai key', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'google key', re: /AIza[A-Za-z0-9_-]{30,}/g },
  { name: 'bearer', re: /Bearer\s+[A-Za-z0-9._-]{20,}/g },
  { name: 'uuid', re: UUID },
];
// Values that are correlation identifiers or deliberate placeholders, not secrets.
const ALLOW = [
  /^0{8}-0{4}-4000-8000-0{12}$/,
  /^1{8}-1{4}-4111-8111-1{12}$/,
];
const isAllowed = (v) => ALLOW.some((r) => r.test(v));

/** Rebuild the text a viewer would actually see from a recorded event stream. */
function reassemble(jsonl) {
  const byId = { content: new Map(), reasoningContent: new Map() };
  const raw = [];
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line) } catch { raw.push(line); continue }
    raw.push(line);
    for (const field of ['content', 'reasoningContent']) {
      if (typeof e[field] === 'string') {
        byId[field].set(e.id, (byId[field].get(e.id) ?? '') + e[field]);
      }
    }
    // Tool arguments stream in fragments too.
    for (const tc of e.toolCalls ?? []) {
      const a = tc?.function?.arguments;
      if (typeof a === 'string') byId.content.set('args:' + tc.id, (byId.content.get('args:' + tc.id) ?? '') + a);
    }
  }
  return {
    rendered: [...byId.content.values(), ...byId.reasoningContent.values()].join('\n'),
    raw: raw.join('\n'),
  };
}

function scan(text, label, out) {
  for (const { name, re } of PATTERNS) {
    for (const m of text.match(re) ?? []) {
      if (name === 'uuid' && isAllowed(m)) continue;
      if (name === 'uuid' && text.includes('fc_' + m)) continue; // tool-call id
      out.push({ label, kind: name, value: m });
    }
  }
}

const targets = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'node_modules' || e === '.git') continue;
    if (statSync(p).isDirectory()) walk(p);
    else targets.push(p);
  }
}
for (const root of process.argv.slice(2).length ? process.argv.slice(2) : ['console/public/fixtures', 'fixtures']) walk(root);

const fieldOnly = [], reassembled = [];
for (const p of targets) {
  const ext = extname(p);
  if (!['.json', '.jsonl', '.txt', '.md', '.log'].includes(ext)) continue;
  const s = readFileSync(p, 'utf8');
  scan(s, p, fieldOnly);                       // what a line/field grep sees
  if (ext === '.jsonl') {
    const { rendered } = reassemble(s);
    scan(rendered, p + ' [rendered]', reassembled);
  }
}

const key = (f) => `${f.kind}:${f.value}`;
const seenFlat = new Set(fieldOnly.map(key));
const missed = reassembled.filter((f) => !seenFlat.has(key(f)));

console.log(`scanned ${targets.length} files`);
console.log(`\nfound by a field/line scan      : ${fieldOnly.length}`);
for (const f of fieldOnly) console.log(`   ${f.kind.padEnd(11)} ${f.value.slice(0, 12)}… in ${f.label}`);
console.log(`\nfound ONLY by reassembling      : ${missed.length}`);
for (const f of missed) console.log(`   ${f.kind.padEnd(11)} ${f.value.slice(0, 12)}… in ${f.label}`);
process.exit(missed.length || fieldOnly.length ? 1 : 0);
