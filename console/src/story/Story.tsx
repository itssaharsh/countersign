// The story under the stage: what Countersign is, why the usual approval prompt is not a
// control, how the four proofs work, the numbers from the real run, how TrueForge is
// load-bearing, and how it was reviewed. Dark base, one deliberate colour interruption
// (the problem), a different accent world per section, and the galaxy bleeding through.
import { motion } from 'framer-motion'
import { NumberTicker } from '../components/fx/NumberTicker'
import { Magnetic, Marquee, Reveal, Stack, TextReveal } from './fx'

const TABLES = ['users', 'orders', 'payments', 'order_items', 'refunds', 'invoices', 'shipments', 'addresses', 'carts', 'cart_items', 'sessions', 'api_keys', 'audit_log', 'coupons', 'reviews', 'tickets', 'ticket_messages', 'subscriptions', 'plans', 'webhooks', 'notifications', 'devices', 'teams', 'team_members', 'projects', 'files', 'comments', 'tags', 'taggings', 'events', 'exports', 'imports', 'ledger', 'payouts', 'disputes', 'kyc_checks', 'wallets', 'transfers', 'currencies', 'regions', 'warehouses', 'inventory']

const REPO = 'https://github.com/itssaharsh/countersign'
const toTop = (e: React.MouseEvent) => { e.preventDefault(); (window as unknown as { __lenis?: { scrollTo: (t: number) => void } }).__lenis?.scrollTo(0) }

export function Story() {
  return (
    <div className="story">
      {/* 1 · manifesto: near-black with the galaxy bleeding through, rose accent */}
      <section className="section world-manifesto" data-shot="manifesto">
        <div className="wrap">
          <Reveal><div className="eyebrow" style={{ color: 'var(--rose)' }}>What this is</div></Reveal>
          <TextReveal as="h2" className="h-lg mt-8 offset-r" style={{ maxWidth: '22ch' }}
            text="Every agent harness ships an approval prompt. It shows a tool name and a JSON blob and asks: allow? Nobody can answer that honestly." />
          <TextReveal className="lede mt-16" style={{ maxWidth: '50ch', color: 'var(--bone)' }}
            text="Countersign answers it before asking. It runs the change inside a shadow transaction, counts every row that would go with it, proves the rollback on committed state, and only then lets the Approve button exist. Approval is a fingerprint of those exact rows, and the commit is scoped to them. We only delete what we can prove we can restore." />
          <Reveal delay={0.1} className="mt-14 flex flex-wrap gap-4">
            <Magnetic strength={0.18}><a className="btn-pill hit" href="#stage" onClick={toTop}>Back to the stage ↑</a></Magnetic>
            <Magnetic strength={0.18}><a className="btn-pill hit" href={REPO} target="_blank" rel="noreferrer">Source on GitHub ↗</a></Magnetic>
          </Reveal>
        </div>
      </section>

      {/* 2 · the problem: the one bright interruption */}
      <section className="section world-problem" data-shot="problem">
        <div className="wrap">
          <Reveal><div className="eyebrow">The problem</div></Reveal>
          <Reveal delay={0.05}><h2 className="h-xl mt-6" style={{ maxWidth: '14ch' }}>You approved a command. You did not approve what it did.</h2></Reveal>
          <div className="grid-2 mt-16 stagger">
            <Reveal delay={0.1}>
              <div className="card glass-dark beam">
                <div className="eyebrow" style={{ color: 'var(--rose)' }}>What the human is shown</div>
                <pre className="t-mono mt-6 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--sand)' }}>{`commit_change {
  "table": "users",
  "where": "last_active < '2025-01-01'"
}`}</pre>
                <div className="mt-8 flex gap-6 t-giant text-[26px]"><span style={{ color: 'var(--green)' }}>Allow</span><span style={{ color: 'var(--coral)' }}>Deny</span></div>
                <p className="body mt-6" style={{ color: 'var(--ink-dim)' }}>A tool name and a JSON blob. This is what every harness shows by default. It is a consent form, not a control.</p>
              </div>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="card" style={{ background: 'var(--bone)', color: 'var(--ink-0)' }}>
                <div className="eyebrow">What actually happens</div>
                <div className="mt-6 space-y-3">
                  <Row name="users" count={6000} note="the rows you meant" />
                  <Row name="orders" count={17971} note="ON DELETE CASCADE" />
                  <Row name="payments" count={19442} note="ON DELETE CASCADE" />
                </div>
                <div className="h-md mt-8">One click. 43,413 rows. No rollback was ever generated.</div>
                <p className="body mt-3" style={{ opacity: 0.75 }}>Two foreign keys away from the table you named, and nothing in the prompt said so.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3 · the mechanism: four stacked tiles, each its own hue */}
      <section className="section world-mechanism" data-shot="mechanism" style={{ paddingBottom: '6vh' }}>
        <div className="wrap">
          <Reveal><div className="eyebrow" style={{ color: 'var(--ice)' }}>How it works</div></Reveal>
          <Reveal delay={0.05}><h2 className="h-xl mt-6 offset-r" style={{ maxWidth: '12ch' }}>Four proofs before a button.</h2></Reveal>
          <div className="mt-20">
            <Stack>
              <Tile n="01" bg="var(--cobalt)" accent="#8fb4ff" title="Shadow execute"
                aside={['BEGIN;', "DELETE FROM users WHERE last_active < '2025-01-01';", 'users −6,000 → orders −17,971 → payments −19,442', 'ROLLBACK;']}
                body="The statement runs for real inside BEGIN then ROLLBACK on the live database. Nothing is estimated. The per-table counts come from the executed plan, walked through every foreign key edge, each one labeled CASCADE, SET NULL or RESTRICT."
                foot="pg_constraint walk · 42 tables · measured, not predicted" />
              <Tile n="02" bg="var(--forest)" accent="#7ef0a8" title="Prove the undo"
                aside={['shadow: apply change, COMMIT', 'undo: 87 statements, run', 'restored_rows 6000', 'pk_set_identical true']}
                body="The undo is generated from pre-image snapshots, then tested like code: the change is applied on a shadow database and committed, the undo runs against that committed state, and the exact primary key set must return. If it does not, the console says NOT RESTORED BY THE GENERATED ROLLBACK."
                foot="87 undo statements · verified on committed state · SET NULL restores included" />
              <Tile n="03" bg="var(--plum)" accent="#d9a8ff" title="Policy by code"
                aside={['max_rows_deleted 50000 · 43,413 ✓', 'protected_tables audit_log, invoices ✓', 'require_verified_undo ✓', 'verdict PASS']}
                body="A deterministic rules engine reads the measured JSON and returns PASS or FAIL. There is no model anywhere in the verdict path. The model proposes; only code blesses. It ships as a TrueForge skill for the sandbox and runs inside the server when the sandbox is off."
                foot="policy.yaml · same verdict every time · sandbox or server" />
              <Tile n="04" bg="var(--graphite)" accent="var(--lime)" title="Arm the gate"
                aside={['count 6000', 'pk_hash 3d2fde29…c22c7c8', 'volatile columns excluded', 'fresh 120 s · commit scoped to keys']}
                body="Only now does TrueForge pause on commit_change. The approval is a fingerprint: the row count plus a hash of the sorted keys and their content, fresh for 120 seconds. The commit deletes by that exact key list. Rows that started matching after measurement void the approval instead of dying."
                foot="fingerprint v2 · scoped commit · drift refuses · undo is one shot" />
            </Stack>
          </div>
        </div>
      </section>

      {/* 4 · numbers: lime on the bleeding galaxy, one anchor number and its satellites */}
      <section className="section world-numbers" data-shot="numbers">
        <div className="wrap">
          <Reveal><div className="eyebrow" style={{ color: 'var(--bone)' }}>From the recorded run</div></Reveal>
          <div className="anchor-grid mt-10">
            <Reveal>
              <div className="t-giant anchor-num"><NumberTicker value={43413} /></div>
              <div className="lede mt-2" style={{ color: 'var(--bone)', maxWidth: '22ch' }}>rows the order would actually take, two foreign keys away from the table it named.</div>
            </Reveal>
            <div className="satellites">
              <Sat v={6000} label="users the order named" />
              <Sat v={87} label="undo statements, each verified on committed state" />
              <Sat v={120} suffix="s" label="an approval stays fresh, then it is void" />
            </div>
          </div>
          <div className="smalls mt-20">
            <Small v={42} label="tables in the estate" />
            <Small v={6000} label="of 6,000 rows returned by the undo" />
            <Small v={11} label="engine tests, one per claim" />
            <Small v={56} label="review findings, all answered" />
          </div>
          <Reveal delay={0.1}><p className="body mt-16" style={{ color: 'var(--ink-dim)', maxWidth: '54ch' }}>Model: gpt-oss-120b on TrueForge. The pause, the countersign and the commit on the stage above are that run, replayed from its recorded harness events.</p></Reveal>
        </div>
        <div className="mt-20 bleed">
          <Marquee>
            {TABLES.map((t) => <span key={t} className="t-giant" style={{ fontSize: 'clamp(28px, 4vw, 64px)', padding: '0 0.45em', color: 'var(--bone)', opacity: 0.5 }}>{t}<span style={{ color: 'var(--lime)', opacity: 1 }}> · </span></span>)}
          </Marquee>
        </div>
      </section>

      {/* 5 · the harness: ice accent, an index rather than a card grid */}
      <section className="section world-harness" data-shot="harness">
        <div className="wrap">
          <Reveal><div className="eyebrow" style={{ color: 'var(--ice)' }}>Built on TrueForge</div></Reveal>
          <Reveal delay={0.05}><h2 className="h-lg mt-6 offset-r" style={{ maxWidth: '18ch' }}>The harness does the work. The console shows its truth.</h2></Reveal>
          <div className="index mt-16">
            <Entry n="01" k="Custom MCP server" t="The shadow transaction has to span many statements on one connection, and the database credential must never reach the model. So the engine is its own MCP server; the agent only ever sees measurements." />
            <Entry n="02" k="Approval pinned by name" t="commit_change and fire_undo are pinned through the API-only require_approval_for_tools field, on top of their destructiveHint annotations. Read tools stay ungated, so investigation never stalls." />
            <Entry n="03" k="Pause and resume" t="The console catches tool.approval_required, resolves the call through sourceEventId, and resumes with user.tool_approval. A denial carries a reason back to the agent." />
            <Entry n="04" k="SDK native" t="No embed. The console speaks createTurnStream, merges deltas, and reconnects to a running turn with subscribeToTurn after a refresh. What you see is the harness's own event stream." />
            <Entry n="05" k="Skill in the sandbox" t="The policy evaluator and dossier renderer ship as a git-backed skill. Where the sandbox is available they run there; where it is not, the same engine runs inside the server." />
            <Entry n="06" k="Catalog preset" t="MCP_CATALOG_PATH and SKILL_CATALOG_PATH overlays make Countersign a one-click preset inside TrueForge's own settings, logo and all." />
          </div>
        </div>
      </section>

      {/* 6 · trust: deep blue world */}
      <section className="section world-trust" data-shot="trust">
        <div className="wrap">
          <Reveal><div className="eyebrow" style={{ color: 'var(--rose)' }}>Reviewed like production</div></Reveal>
          <Reveal delay={0.05}><h2 className="h-lg mt-6" style={{ maxWidth: '16ch' }}>Eleven pull requests. Fifty six findings. Every one answered.</h2></Reveal>
          <div className="trust-grid mt-14">
            <Reveal delay={0.1}><p className="body" style={{ maxWidth: '46ch', opacity: 0.92 }}>Every substantive change went through a pull request reviewed by Qodo before merge. The first review found a real hole in the core promise: the drift fingerprint covered only root keys, so a cascade child added after measurement could be deleted without undo coverage. The fingerprint was rebuilt around it. Each finding is fixed or dismissed with a reason in the thread, and the whole trail is in the repo.</p></Reveal>
            <Reveal delay={0.15}>
              <div className="card glass beam receipt">
                <div className="eyebrow" style={{ color: 'var(--lime)' }}>Receipt, as posted to the PR</div>
                <div className="t-mono mt-5 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                  simulation cdac3df6 · destructive-cascade<br />
                  approved 6,000 keys · deleted 6,000 root rows<br />
                  cascade: orders −17,971 · payments −19,442<br />
                  undo: 87 statements · verified on committed state<br />
                  policy: PASS · fingerprint fresh at commit<br />
                  undo fired · 6,000 of 6,000 keys returned
                </div>
                <Magnetic strength={0.18}><a className="btn-pill hit mt-8" href={`${REPO}/blob/main/docs/QODO-LOG.md`} target="_blank" rel="noreferrer">Read the review log ↗</a></Magnetic>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7 · run it */}
      <section className="section world-run" data-shot="run">
        <div className="wrap">
          <Reveal><div className="eyebrow">Run it</div></Reveal>
          <Reveal delay={0.05}><h2 className="h-lg mt-6" style={{ maxWidth: '16ch' }}>No keys needed to watch the real run.</h2></Reveal>
          <div className="grid-2 mt-14">
            <Reveal delay={0.1}>
              <div className="eyebrow mb-3">Judge mode, two commands</div>
              <div className="kbd">git clone {REPO} && cd countersign && npm install</div>
              <div className="kbd mt-3">npm run dev -w console</div>
              <p className="body mt-5" style={{ opacity: 0.8 }}>Then open the replay URL from the README. The recorded gpt-oss-120b stream plays through the live reducer and holds at the gate until you countersign.</p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="eyebrow mb-3">Live, about fifteen minutes</div>
              <div className="kbd">node db/seed.mjs && node server/src/index.mjs</div>
              <div className="kbd mt-3">npx @truefoundry/trueforge@latest</div>
              <div className="kbd mt-3">node agent/create-agent.mjs</div>
              <p className="body mt-5" style={{ opacity: 0.8 }}>Add a model in TrueForge, register the MCP server, and transmit an order from the stage. The decision is yours.</p>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="mt-20 flex flex-wrap items-center gap-4">
            <Magnetic strength={0.18}><a className="btn-pill hit" href="#stage" onClick={toTop}>Back to the stage ↑</a></Magnetic>
            <Magnetic strength={0.18}><a className="btn-pill hit" href={REPO} target="_blank" rel="noreferrer">github.com/itssaharsh/countersign ↗</a></Magnetic>
            <span className="t-tag" style={{ color: 'var(--ink-dim)' }}>The Agent Harness Hackathon · WeMakeDevs × TrueFoundry × Qodo · solo build · MIT</span>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

function Row({ name, count, note }: { name: string; count: number; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-3" style={{ borderColor: 'rgba(14,13,18,0.14)' }}>
      <span className="t-mono text-[14px]">{name}</span>
      <span className="t-giant text-[28px]" style={{ color: 'var(--orange)' }}>−{count.toLocaleString()}</span>
      <span className="t-tag" style={{ color: 'rgba(14,13,18,0.6)' }}>{note}</span>
    </div>
  )
}

function Tile({ n, bg, accent, title, body, foot, aside }: { n: string; bg: string; accent: string; title: string; body: string; foot: string; aside: string[] }) {
  return (
    <motion.div className="stack-card" style={{ background: bg }} whileHover="hover">
      <div className="tile-head">
        <motion.div className="num" style={{ color: accent }} variants={{ hover: { x: 14 } }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>{n}</motion.div>
        <h3 className="h-lg mt-6">{title}</h3>
      </div>
      <div className="tile-aside t-mono">
        {aside.map((line, i) => <div key={i} style={{ color: i === aside.length - 1 ? accent : undefined }}>{line}</div>)}
      </div>
      <div className="tile-body">
        <p className="body" style={{ opacity: 0.92 }}>{body}</p>
        <div className="t-tag mt-8" style={{ color: accent }}>{foot}</div>
      </div>
    </motion.div>
  )
}

function Sat({ v, label, suffix = '' }: { v: number; label: string; suffix?: string }) {
  return (
    <Reveal>
      <div className="t-giant" style={{ fontSize: 'clamp(40px, 4.6vw, 84px)', whiteSpace: 'nowrap' }}><NumberTicker value={v} />{suffix}</div>
      <div className="body mt-1" style={{ color: 'var(--bone)', opacity: 0.75, maxWidth: '26ch' }}>{label}</div>
    </Reveal>
  )
}

function Small({ v, label }: { v: number; label: string }) {
  return (
    <Reveal>
      <div className="t-giant" style={{ fontSize: 'clamp(26px, 2.4vw, 44px)', whiteSpace: 'nowrap' }}><NumberTicker value={v} /></div>
      <div className="t-tag mt-2" style={{ color: 'var(--bone)', opacity: 0.6 }}>{label}</div>
    </Reveal>
  )
}

function Entry({ n, k, t }: { n: string; k: string; t: string }) {
  return (
    <Reveal>
      <div className="entry">
        <div className="t-mono text-[13px]" style={{ color: 'var(--ice)' }}>{n}</div>
        <div className="h-md">{k}</div>
        <p className="body" style={{ opacity: 0.8 }}>{t}</p>
      </div>
    </Reveal>
  )
}
