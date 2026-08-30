// The deterministic policy engine, on its own.
//
// pipeline.test.mjs covers the happy path against a real database, which is slow
// and only ever produces PASS. Every FAIL verdict is therefore untested there,
// and a rule that can only be observed passing is not a rule anyone has checked.
// These run in milliseconds against fixed input and assert each verdict on its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluatePolicy } from '../src/policy.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'countersign-policy-'));

/** Write a policy file and hand back its path, so each case states its own limits. */
function policy(body) {
  const p = join(scratch, `policy-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(p, body);
  return p;
}

const STRICT = policy(`max_rows_deleted: 50000
protected_tables:
  - audit_log
  - invoices
require_verified_undo: true
`);

const measurement = (tables, undo = { verified: true }) => ({ tables, undo });
const ruleFor = (result, name) => result.rules.find((r) => r.rule === name);

test('a clean measurement passes every rule', () => {
  const r = evaluatePolicy(measurement([
    { name: 'users', delta: 6000 },
    { name: 'orders', delta: 17971, onDelete: 'CASCADE' },
    { name: 'payments', delta: 19442, onDelete: 'CASCADE' },
  ]), STRICT);
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.rules.length, 4);
  assert.ok(r.rules.every((x) => x.pass));
});

test('max_rows_deleted counts every table, not just the one named', () => {
  // 6,000 alone is well under the limit. The cascade is what breaches it, which
  // is the entire reason the limit is checked against the measurement and not
  // against the statement.
  const r = evaluatePolicy(measurement([
    { name: 'users', delta: 6000 },
    { name: 'orders', delta: 45000, onDelete: 'CASCADE' },
  ]), STRICT);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(ruleFor(r, 'max_rows_deleted').pass, false);
  assert.match(ruleFor(r, 'max_rows_deleted').detail, /51000 rows deleted vs limit 50000/);
});

test('protected_tables fails on rows lost, and names the table', () => {
  const r = evaluatePolicy(measurement([
    { name: 'users', delta: 10 },
    { name: 'audit_log', delta: 2400, onDelete: 'CASCADE' },
  ]), STRICT);
  assert.equal(r.verdict, 'FAIL');
  assert.match(ruleFor(r, 'protected_tables').detail, /audit_log/);
});

test('a protected table that only loses a reference does not fail the rule', () => {
  // Protection is about rows dying. A nulled foreign key leaves every row in
  // place, and failing here would block changes the policy does not forbid.
  const r = evaluatePolicy(measurement([
    { name: 'users', delta: 10 },
    { name: 'invoices', delta: 0, affected: 12, onDelete: 'SET NULL' },
  ]), STRICT);
  assert.equal(ruleFor(r, 'protected_tables').pass, true);
  assert.equal(r.verdict, 'PASS');
});

test('require_verified_undo fails when the rollback was never proven', () => {
  const r = evaluatePolicy(measurement([{ name: 'users', delta: 10 }], { verified: false }), STRICT);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(ruleFor(r, 'require_verified_undo').pass, false);
});

test('an absent undo report is treated as unproven, never as absent of objection', () => {
  // Built without the helper on purpose: a default parameter would substitute a
  // verified undo for the missing one, which is exactly the substitution the rule
  // must never make. Only a literal `true` passes.
  for (const undo of [undefined, null, {}, { verified: 'yes' }, { verified: 1 }]) {
    const r = evaluatePolicy({ tables: [{ name: 'users', delta: 10 }], undo }, STRICT);
    assert.equal(ruleFor(r, 'require_verified_undo').pass, false, `undo=${JSON.stringify(undo)}`);
    assert.equal(r.verdict, 'FAIL');
  }
});

test('require_verified_undo can be switched off, and then an unproven undo passes', () => {
  const lax = policy(`max_rows_deleted: 50000
protected_tables:
  - audit_log
require_verified_undo: false
`);
  const r = evaluatePolicy(measurement([{ name: 'users', delta: 10 }], { verified: false }), lax);
  assert.equal(ruleFor(r, 'require_verified_undo').pass, true);
  assert.equal(r.verdict, 'PASS');
});

test('restrict_edges_block fails only when rows sit behind the RESTRICT edge', () => {
  const empty = evaluatePolicy(measurement([
    { name: 'users', delta: 10 },
    { name: 'invoices', delta: 0, affected: 0, onDelete: 'RESTRICT' },
  ]), STRICT);
  assert.equal(ruleFor(empty, 'restrict_edges_block').pass, true);

  const blocking = evaluatePolicy(measurement([
    { name: 'users', delta: 10 },
    { name: 'invoices', delta: 0, affected: 12, onDelete: 'RESTRICT' },
  ]), STRICT);
  assert.equal(ruleFor(blocking, 'restrict_edges_block').pass, false);
  assert.match(ruleFor(blocking, 'restrict_edges_block').detail, /invoices/);
});

test('the verdict is a pure function of the measurement', () => {
  // Same input, same answer, every time. This is the claim that lets the README
  // say no model sits in the verdict path, so it is worth asserting rather than
  // asserting about.
  const m = measurement([{ name: 'users', delta: 60000 }]);
  const a = evaluatePolicy(m, STRICT);
  const b = evaluatePolicy(m, STRICT);
  assert.deepEqual(a.rules, b.rules);
  assert.equal(a.verdict, b.verdict);
});

test('every failing rule is reported, not just the first', () => {
  const r = evaluatePolicy(measurement([
    { name: 'audit_log', delta: 60000 },
    { name: 'invoices', delta: 0, affected: 5, onDelete: 'RESTRICT' },
  ], { verified: false }), STRICT);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.rules.filter((x) => !x.pass).length, 4);
});
