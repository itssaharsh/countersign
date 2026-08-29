// Countersign demo estate — deterministic schema + seed SQL generator.
// One source of truth used by both PGlite (dev/shadow) and Postgres/Supabase (live demo).
// The hero chain: users --CASCADE--> orders --CASCADE--> payments, with contrasting
// SET NULL / RESTRICT edges so the cascade tree shows real, mixed semantics.

// Mulberry32 — tiny deterministic PRNG so every seed run yields identical data.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COUNTS = {
  users: 18000,          // 6,000 of these are "inactive" → the doomed set
  doomedUsers: 6000,
  maxOrdersPerDoomedUser: 6,
  maxOrdersPerActiveUser: 2,
  // invoices against DOOMED orders is deliberately 0. Populating it does not make
  // `restrict_edges_block` reachable: the shadow DELETE aborts on the foreign key
  // before policy is ever evaluated, so the run fails with the database's own
  // error rather than a FAIL verdict — and it breaks the demo statement outright.
  // See README, "Two of four policy rules".
  quietInvoices: 120,    // invoices, all against the reserved band's orders
  reservedUsers: 1000,   // newest users; their orders carry the invoices
  auditRows: 2400,       // audit_log is protected; a statement aimed at it must have rows
};

export function schemaSql() {
  const stmts = [];
  stmts.push(`
    CREATE TABLE users (
      id integer PRIMARY KEY,
      email text NOT NULL,
      full_name text NOT NULL,
      legacy_phone text,
      last_active date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  stmts.push(`
    CREATE TABLE orders (
      id integer PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_cents integer NOT NULL,
      status text NOT NULL,
      placed_at timestamptz NOT NULL DEFAULT now()
    )`);
  stmts.push(`
    CREATE TABLE payments (
      id integer PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount_cents integer NOT NULL,
      method text NOT NULL,
      captured boolean NOT NULL DEFAULT true
    )`);
  stmts.push(`
    CREATE TABLE support_tickets (
      id integer PRIMARY KEY,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      subject text NOT NULL,
      open boolean NOT NULL DEFAULT false
    )`);
  stmts.push(`
    CREATE TABLE invoices (
      id integer PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      pdf_path text NOT NULL
    )`);
  stmts.push(`
    CREATE TABLE audit_log (
      id integer PRIMARY KEY,
      actor text NOT NULL,
      action text NOT NULL,
      subject_table text NOT NULL,
      subject_id integer,
      at timestamptz NOT NULL DEFAULT now()
    )`);
  // Breadth: a catalog of small satellite tables so schema introspection and
  // Code Mode aggregation have a realistic surface to sweep, each with a real FK.
  const satellites = [
    'products','categories','inventory','warehouses','suppliers','shipments','returns',
    'refunds','coupons','campaigns','emails_sent','page_views','carts','cart_items',
    'wishlists','reviews','review_votes','addresses','payment_methods','subscriptions',
    'plans','features','feature_flags','api_keys_meta','webhooks','webhook_deliveries',
    'notes','tags','taggings','files_meta','exports','imports','jobs','job_runs','teams','team_members',
  ];
  for (const t of satellites) {
    stmts.push(`
    CREATE TABLE ${t} (
      id integer PRIMARY KEY,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  }
  // FK indexes — real estates index their FK columns, and cascade deletes are
  // O(N*M) table scans without them.
  stmts.push('CREATE INDEX idx_orders_user_id ON orders(user_id)');
  stmts.push('CREATE INDEX idx_payments_order_id ON payments(order_id)');
  stmts.push('CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id)');
  stmts.push('CREATE INDEX idx_invoices_order_id ON invoices(order_id)');
  for (const t of satellites) {
    stmts.push(`CREATE INDEX idx_${t}_user_id ON ${t}(user_id)`);
  }
  return stmts;
}

export function seedSql() {
  const rand = mulberry32(20260828);
  const stmts = [];
  const userRows = [];
  for (let i = 1; i <= COUNTS.users; i++) {
    const doomed = i <= COUNTS.doomedUsers;
    // Doomed users went inactive in 2024; active users have 2026 activity.
    const lastActive = doomed
      ? `2024-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`
      : `2026-${String(1 + Math.floor(rand() * 8)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`;
    const phone = rand() < 0.4 ? `'+1${String(2000000000 + Math.floor(rand() * 999999999))}'` : 'NULL';
    userRows.push(`(${i},'u${i}@example.test','User ${i}',${phone},'${lastActive}')`);
  }
  chunk(userRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO users (id,email,full_name,legacy_phone,last_active) VALUES ${c.join(',')}`));

  let orderId = 0, paymentId = 0;
  const orderRows = [], paymentRows = [];
  // Orders belonging to doomed users. Tracked so the invoice seeding can be sure to
  // AVOID them: an invoice against a doomed order puts rows behind the RESTRICT
  // edge, and the shadow DELETE then aborts on the foreign key before policy runs.
  // See COUNTS and the README on why that rule cannot be reached at all.
  const doomedOrderIds = [];
  // Orders belonging to a reserved band of the newest users. Invoices hang off
  // these, so no demo statement's blast path ever reaches the RESTRICT edge and
  // aborts the shadow transaction.
  const reservedOrderIds = [];
  for (let u = 1; u <= COUNTS.users; u++) {
    const doomed = u <= COUNTS.doomedUsers;
    const n = Math.floor(rand() * (doomed ? COUNTS.maxOrdersPerDoomedUser + 1 : COUNTS.maxOrdersPerActiveUser + 1));
    for (let k = 0; k < n; k++) {
      orderId++;
      if (doomed) doomedOrderIds.push(orderId);
      else if (u > COUNTS.users - COUNTS.reservedUsers) reservedOrderIds.push(orderId);
      orderRows.push(`(${orderId},${u},${500 + Math.floor(rand() * 90000)},'complete')`);
      const nPay = 1 + (rand() < 0.08 ? 1 : 0); // some orders have a retry payment
      for (let p = 0; p < nPay; p++) {
        paymentId++;
        paymentRows.push(`(${paymentId},${orderId},${500 + Math.floor(rand() * 90000)},'card')`);
      }
    }
  }
  chunk(orderRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO orders (id,user_id,total_cents,status) VALUES ${c.join(',')}`));
  chunk(paymentRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO payments (id,order_id,amount_cents,method) VALUES ${c.join(',')}`));

  // invoices: ON DELETE RESTRICT against orders. The table is populated so the
  // RESTRICT edge is real and the console's note about it is a true statement
  // rather than one about an empty table. None of them sit in the demo's blast
  // path — see COUNTS.blockingInvoices for why that is not an oversight.
  const invoiceRows = [];
  for (let i = 0; i < COUNTS.quietInvoices && reservedOrderIds.length; i++) {
    invoiceRows.push(`(${i + 1},${reservedOrderIds[i % reservedOrderIds.length]},'invoices/${9000 + i}.pdf')`);
  }
  chunk(invoiceRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO invoices (id,order_id,pdf_path) VALUES ${c.join(',')}`));

  // audit_log has no foreign key, so it is never reached by a cascade. It is
  // populated so that a statement aimed AT it has rows to delete — which is how
  // `protected_tables` is reached: the operator names a protected table directly.
  const auditRows = [];
  for (let i = 1; i <= COUNTS.auditRows; i++) {
    const subject = 1 + Math.floor(rand() * COUNTS.users);
    auditRows.push(`(${i},'svc-billing','user.updated','users',${subject})`);
  }
  chunk(auditRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO audit_log (id,actor,action,subject_table,subject_id) VALUES ${c.join(',')}`));

  const ticketRows = [];
  for (let i = 1; i <= 3000; i++) {
    ticketRows.push(`(${i},${1 + Math.floor(rand() * COUNTS.users)},'Ticket ${i}',${rand() < 0.2})`);
  }
  chunk(ticketRows, 1000).forEach((c) =>
    stmts.push(`INSERT INTO support_tickets (id,user_id,subject,open) VALUES ${c.join(',')}`));

  const satellites = [
    'products','categories','inventory','warehouses','suppliers','shipments','returns',
    'refunds','coupons','campaigns','emails_sent','page_views','carts','cart_items',
    'wishlists','reviews','review_votes','addresses','payment_methods','subscriptions',
    'plans','features','feature_flags','api_keys_meta','webhooks','webhook_deliveries',
    'notes','tags','taggings','files_meta','exports','imports','jobs','job_runs','teams','team_members',
  ];
  for (const t of satellites) {
    const rows = [];
    const n = 50 + Math.floor(rand() * 400);
    for (let i = 1; i <= n; i++) {
      rows.push(`(${i},${1 + Math.floor(rand() * COUNTS.users)},'${t} ${i}')`);
    }
    stmts.push(`INSERT INTO ${t} (id,user_id,label) VALUES ${rows.join(',')}`);
  }
  return stmts;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// The two demo change orders.
export const CHANGES = {
  purgeInactive: {
    id: 'purge-inactive-users',
    sql: "DELETE FROM users WHERE last_active < '2025-01-01'",
    kind: 'destructive-cascade',
  },
  addOptOut: {
    id: 'add-marketing-opt-out',
    sql: 'ALTER TABLE users ADD COLUMN marketing_opt_out boolean NOT NULL DEFAULT false',
    undo: 'ALTER TABLE users DROP COLUMN marketing_opt_out',
    kind: 'reversible',
  },
};
