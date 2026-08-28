// Foreign-key graph: read real edges from pg_constraint and compute which tables a
// DELETE on `root` can reach, with the actual ON DELETE semantics per edge.
// This is a measurement, not an estimate: counts come from executed JOIN queries.

const ACTION = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

/** All FK edges in public schema: child -> parent with on-delete semantics. */
export async function fkEdges(db) {
  const rows = await db.rows(`
    SELECT con.conname                          AS constraint_name,
           child.relname                        AS child_table,
           parent.relname                       AS parent_table,
           con.confdeltype                      AS on_delete,
           (SELECT attname FROM pg_attribute
             WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) AS child_column
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid  = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    WHERE con.contype = 'f' AND ns.nspname = 'public'`);
  return rows.map((r) => ({
    constraint: r.constraint_name,
    child: r.child_table,
    parent: r.parent_table,
    childColumn: r.child_column,
    onDelete: ACTION[r.on_delete] ?? r.on_delete,
  }));
}

/**
 * Breadth-first walk from `root`: which tables are reachable when rows in root die,
 * and by which edge semantics. Returns ordered hops (parents before children).
 */
export function reachableFrom(root, edges) {
  const hops = [];
  const visited = new Set([root]);
  let frontier = [root];
  while (frontier.length) {
    const next = [];
    for (const parent of frontier) {
      for (const e of edges.filter((e) => e.parent === parent)) {
        hops.push({ ...e, depth: hops.length });
        if (!visited.has(e.child) && e.onDelete === 'CASCADE') {
          visited.add(e.child);
          next.push(e.child); // only CASCADE keeps propagating deletes
        }
      }
    }
    frontier = next;
  }
  return hops;
}
