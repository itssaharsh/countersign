// The policy file parser.
//
// It is hand-rolled and dependency-free, which is defensible for a file we own,
// but it means the policy engine's input is parsed by twenty lines of regex that
// nothing else checks. A silent misparse here does not throw: it hands the engine
// a policy that is not the one on disk, and the verdict is wrong while looking
// entirely normal. These tests pin the subset the parser actually claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../src/tiny-yaml.mjs';

const POLICY = new URL('../../skills/countersign-dossier/references/policy.yaml', import.meta.url).pathname;

test('parses the shipped policy file into the shape the engine expects', () => {
  const p = parse(readFileSync(POLICY, 'utf8'));
  assert.equal(typeof p.max_rows_deleted, 'number');
  assert.ok(Array.isArray(p.protected_tables));
  assert.equal(typeof p.require_verified_undo, 'boolean');
  // The engine calls .includes() on this, so a string here would match substrings
  // and silently protect every table whose name is a substring of another.
  assert.ok(p.protected_tables.every((t) => typeof t === 'string'));
});

test('coerces scalars by type rather than leaving everything a string', () => {
  const p = parse('limit: 50000\nflag: true\noff: false\nname: audit_log\n');
  assert.equal(p.limit, 50000);
  assert.equal(p.flag, true);
  assert.equal(p.off, false);
  assert.equal(p.name, 'audit_log');
});

test('reads a list under its key and stops at the next key', () => {
  const p = parse('protected_tables:\n  - audit_log\n  - invoices\nrequire_verified_undo: true\n');
  assert.deepEqual(p.protected_tables, ['audit_log', 'invoices']);
  assert.equal(p.require_verified_undo, true);
});

test('an empty list stays an empty array, so .includes() still works', () => {
  // A policy protecting nothing must parse to [], never to undefined: the engine
  // calls .includes() on it unguarded and would throw on the latter.
  const p = parse('protected_tables:\nmax_rows_deleted: 10\n');
  assert.deepEqual(p.protected_tables, []);
  assert.equal(p.max_rows_deleted, 10);
});

test('strips comments, whole-line and trailing', () => {
  const p = parse('# a header comment\nmax_rows_deleted: 50000 # the ceiling\n');
  assert.equal(p.max_rows_deleted, 50000);
  assert.deepEqual(Object.keys(p), ['max_rows_deleted']);
});

test('quoted values lose their quotes', () => {
  const p = parse(`a: "audit_log"\nb: 'invoices'\n`);
  assert.equal(p.a, 'audit_log');
  assert.equal(p.b, 'invoices');
});

test('a negative number is a number', () => {
  assert.equal(parse('n: -5\n').n, -5);
});

test('ignores blank lines and lines it does not understand', () => {
  const p = parse('\n\nmax_rows_deleted: 1\n   \nthis is not yaml\n');
  assert.equal(p.max_rows_deleted, 1);
});

test('a later key wins, so a duplicated setting is not silently merged', () => {
  assert.equal(parse('max_rows_deleted: 1\nmax_rows_deleted: 2\n').max_rows_deleted, 2);
});

// Documented limits, and one of them is dangerous enough to pin here rather than
// leave for someone to discover in production.
test('nesting is silently flattened, never reported', () => {
  // An indented line matches neither the list-item pattern nor the key pattern,
  // so it is dropped. Depth is invisible to the parser: an indented list item is
  // attached to the last key seen, whatever level it was written at, and a
  // sub-map with no items leaves its key an empty array.
  //
  // The consequence is the repo's recurring failure shape. A policy written with
  // any nesting parses into something that is not what is on disk, every check
  // runs against it without complaint, and the verdict is a confident PASS over a
  // policy nobody actually applied.
  assert.deepEqual(
    parse('protected_tables:\n  tables:\n    - audit_log\n').protected_tables,
    ['audit_log'],
    'the nested item is hoisted to the outer key',
  );
  assert.deepEqual(
    parse('limits:\n  rows:\n    max: 10\n').limits,
    [],
    'a sub-map with no list items leaves an empty array',
  );
  // Keep policy.yaml flat. If nesting is ever needed here, the parser has to
  // start throwing on input it does not understand rather than returning a
  // partial map that reads as valid.
});

test('an inline list is left as an unparsed string, not a list', () => {
  // Also silent, but at least the wrong type: .includes() on a string does
  // substring matching, so a table named "invoice" would match "invoices".
  const inline = parse('protected_tables: [audit_log, invoices]\n');
  assert.equal(typeof inline.protected_tables, 'string');
});
