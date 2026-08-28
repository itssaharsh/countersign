// Deterministic policy engine — the "only code blesses" half of the thesis.
// No LLM anywhere in this file. The same engine runs in the TrueForge sandbox
// (via the countersign-dossier skill) or in-process here; identical input JSON
// must yield an identical verdict either way.
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from './tiny-yaml.mjs';

const DEFAULT_POLICY_PATH = new URL('../../skills/countersign-dossier/references/policy.yaml', import.meta.url).pathname;

export function evaluatePolicy(measurement, policyPath = DEFAULT_POLICY_PATH) {
  const policy = parseYaml(readFileSync(policyPath, 'utf8'));
  const rules = [];
  const total = measurement.tables.reduce((s, t) => s + (t.delta ?? 0), 0);

  rules.push(check('max_rows_deleted', total <= policy.max_rows_deleted,
    `${total} rows deleted vs limit ${policy.max_rows_deleted}`));
  const touchedProtected = measurement.tables
    .filter((t) => (t.delta ?? 0) > 0 && policy.protected_tables.includes(t.name)).map((t) => t.name);
  rules.push(check('protected_tables', touchedProtected.length === 0,
    touchedProtected.length ? `deletes rows in protected: ${touchedProtected.join(', ')}` : 'no protected table loses rows'));
  rules.push(check('require_verified_undo',
    !policy.require_verified_undo || measurement.undo?.verified === true,
    measurement.undo?.verified ? 'undo verified against committed shadow state' : 'undo NOT verified'));
  const restricted = measurement.tables.filter((t) => t.onDelete === 'RESTRICT' && (t.affected ?? 0) > 0);
  rules.push(check('restrict_edges_block', restricted.length === 0,
    restricted.length ? `RESTRICT edges would abort the real run: ${restricted.map((t) => t.name).join(', ')}` : 'no RESTRICT edge in the blast path'));

  const failures = rules.filter((r) => !r.pass);
  return {
    verdict: failures.length ? 'FAIL' : 'PASS',
    rules,
    evaluated_at: new Date().toISOString(),
    engine: 'deterministic-v1 (no LLM in the verdict path)',
    scope: 'Rules cover row deltas, protected tables, undo verification, RESTRICT edges. They do NOT cover grants, triggers, sequences, or non-row side effects.',
  };
}
function check(rule, pass, detail) { return { rule, pass, detail }; }
