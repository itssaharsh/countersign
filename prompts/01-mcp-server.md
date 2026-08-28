# Workstream: countersign MCP server (server/)

TypeScript, @modelcontextprotocol/sdk (verify exact import surface from its README before coding),
streamable HTTP transport on localhost:8977, no auth (localhost only).

## Tools (annotate correctly — TrueForge gates by MCP annotations by default)
- simulate_change{change_sql, target_predicate?} → readOnlyHint:true. Opens tx on LIVE db:
  snapshot reachable rows (pg_constraint FK walk, CREATE TEMP TABLE per reachable table),
  EXPLAIN + execute change, measure per-table row/col deltas, generate undo SQL from snapshots,
  ROLLBACK. Returns measurement JSON {tables:[{name, delta, cascade_edge}], undo_sql_path,
  duration_ms, fingerprint:{count, pk_hash, measured_at}}.
- verify_undo{simulation_id} → readOnlyHint:true on LIVE; writes on SHADOW db only. Restores shadow
  to post-change committed state, applies undo, asserts PK set identity. Returns {verified:bool,
  restored:n/n, pk_set_identical:bool, undo_token}.
- fingerprint_target{predicate} → readOnlyHint:true. count + sha256 of sorted PKs (normalize
  volatile cols: updated_at, last_seen).
- commit_change{simulation_id, undo_token, fingerprint} → destructiveHint:true. SERVER-SIDE GUARD:
  refuse unless fingerprint fresh (re-measure now, compare), undo_token valid, policy PASS recorded.
  Execute scoped to captured PK list. Then measure_actual and emit receipt JSON.
- fire_undo{simulation_id} → destructiveHint:true (also gated). Executes verified undo on LIVE.
- measure_actual{simulation_id} → readOnlyHint:true.

## DB layer
pg via `postgres` or `pg` npm lib; connection strings from env (LIVE_DATABASE_URL, SHADOW_DATABASE_URL).
Dev default: PGlite (@electric-sql/pglite) with the same seed. One pool per db; simulate holds a
single session for its tx.

## Acceptance
- `npm test` covers: cascade measurement matches seeded expectations; undo verified on shadow;
  commit refused on stale fingerprint; commit refused without policy PASS; scoped commit ignores
  rows inserted after measurement (reported, not deleted).
- Registered in TrueForge via Add MCP Server; tools listed; simulate runs ungated; commit_change
  pauses the turn.
