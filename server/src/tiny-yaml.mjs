// Minimal YAML subset parser for policy.yaml (scalars, string lists, flat maps).
// Deliberately tiny and dependency-free: the policy file is ours, reviewed, and simple.
export function parse(text) {
  const out = {};
  let listKey = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const listItem = /^\s+-\s*(.+)$/.exec(line);
    if (listItem && listKey) { out[listKey].push(coerce(listItem[1])); continue; }
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, val] = kv;
    if (val === '') { out[key] = []; listKey = key; }
    else { out[key] = coerce(val); listKey = null; }
  }
  return out;
}
function coerce(v) {
  const t = v.trim().replace(/^['"]|['"]$/g, '');
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return Number(t);
  return t;
}
