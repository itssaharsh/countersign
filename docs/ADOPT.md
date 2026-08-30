# Using Countersign on your own database

Countersign is not tied to this repo's schema. The foreign-key walk reads `pg_constraint`
directly, so the cascade it measures is whatever your database actually declares. Pointing it
at your own estate is configuration, not a fork.

## What you change

**1. Point the engine at two databases.**

```bash
LIVE_DATABASE_URL=postgres://…/your_db          # the database the change targets
SHADOW_DATABASE_URL=postgres://…/your_db_shadow # a disposable copy
node server/src/index.mjs
```

`LIVE` is where the change would land. `SHADOW` is where the generated undo is replayed
against committed state to prove it works. Without a real shadow copy the undo verification
is meaningless, so this is the one setting you cannot fake — it must be a copy of live, not
an empty database.

If you omit both, the engine falls back to local PGlite directories, which is how the demo
runs with no external services.

**2. Write your policy.**

`skills/countersign-dossier/references/policy.yaml`:

```yaml
max_rows_deleted: 50000
protected_tables:
  - audit_log
  - invoices
require_verified_undo: true
```

These are your rules, evaluated by deterministic code with no model anywhere in the verdict
path. `protected_tables` are tables that must never lose rows; a statement that would delete
from one fails the policy and no approval is offered.

**3. Register the MCP server with your harness.**

The engine is a streamable-HTTP MCP server on `127.0.0.1:8977`. In TrueForge: Settings →
Connectors → Add MCP Server. The important part of the agent manifest is one field:

```json
"require_approval_for_tools": ["commit_change", "fire_undo"]
```

That is what makes the harness pause. Read tools stay ungated so investigation never stalls;
only the two irreversible tools raise an approval.

**4. Set an admin token if the engine is reachable by anything but you.**

```bash
COUNTERSIGN_ADMIN_TOKEN=…    # guards /admin/reseed and /admin/drift
```

The engine binds to `127.0.0.1` and the token is the second wall.

## What you do not change

- **The schema.** The FK graph is read from `pg_constraint` at measurement time, including
  each edge's real `ON DELETE` semantics. Add a table tomorrow and it is measured tomorrow.
- **The console.** It renders whatever `/state` reports. There is no per-schema view code.
- **The credentials.** They stay in the engine process. The model receives measurements and a
  one-shot token, never a connection string.

## What it does not cover

Stated plainly, because a safety tool that overstates its coverage is worse than none:

- The policy engine reasons about **row deltas, protected tables, undo verification and
  RESTRICT edges**. It does **not** cover grants, triggers, sequences, or non-row side
  effects. A trigger that fires on delete is outside what is measured.
- The classifier accepts **a single statement**. Multi-statement migrations are rejected
  rather than partially understood.
- `restrict_edges_block` cannot fire in practice: any statement reaching a RESTRICT edge with
  rows behind it aborts inside the shadow transaction before policy runs, so the database's
  own enforcement gets there first. The rule is redundant rather than load-bearing.
- Undo generation is built from pre-image snapshots of the rows a statement touches. It
  restores rows and cleared references; it does not restore anything the database did not tell
  it about.

## The shortest possible version

Point it at two databases, write four lines of policy, pin two tool names for approval. The
measurement, the undo proof and the gate work the same on any Postgres schema, because none of
it is written against a schema.
