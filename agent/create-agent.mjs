// Create or update the named "countersign" agent from agent/spec.json.
// The interesting line is require_approval_for_tools — an API-only field: the literal
// tool names commit_change and fire_undo pause the turn for human approval, while the
// measurement tools run autonomously.
import { readFileSync } from 'node:fs';

const BASE = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
// --mock switches the agent to the zero-credit scripted model (tools/mock-model.mjs);
// --real switches back to the configured Gemini model for demo runs.
const MOCK = process.argv.includes('--mock');
const REAL = process.argv.includes('--real');
const specPath = new URL('./spec.json', import.meta.url);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
if (MOCK) spec.manifest.model = { name: 'mocksmith/scripted-1' };
if (REAL) {
  // Lean demo profile for TPM-limited free tiers: one preloaded server, no
  // discovery hops, no sandbox/subagent guidance. Same product, fewer calls.
  spec.manifest.model = { name: 'groq/gpt-oss-120b', params: { temperature: 0.1, max_tokens: 2048, reasoning_effort: 'low' } };
  spec.manifest.mcp_servers = [
    { name: 'countersign', enable_tools: ['@all'], require_approval_for_tools: ['commit_change', 'fire_undo'], preload: true },
  ];
  spec.manifest.skills = [];
  spec.manifest.config = { ...spec.manifest.config, sandbox: { enabled: false }, dynamic_sub_agents: { enabled: false }, ask_user_questions: { enabled: false }, generative_ui: { enabled: false } };
}
if (spec.manifest.instructions?.startsWith('@')) {
  spec.manifest.instructions = readFileSync(new URL('../' + spec.manifest.instructions.slice(1), import.meta.url), 'utf8');
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const list = await api('GET', '/agents');
const existing = (list.json.data ?? []).find((a) => a.name === spec.name);
if (existing) {
  const r = await api('PUT', `/agents/${existing.id}`, { manifest: spec.manifest });
  console.log(r.status === 200 ? `updated agent ${spec.name} (${existing.id})` : `update failed: ${r.status} ${JSON.stringify(r.json)}`);
} else {
  const r = await api('POST', '/agents', { name: spec.name, manifest: spec.manifest });
  console.log(r.status < 300 ? `created agent ${spec.name} (${r.json.data?.id})` : `create failed: ${r.status} ${JSON.stringify(r.json)}`);
}
