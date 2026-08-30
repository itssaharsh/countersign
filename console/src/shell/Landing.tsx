// The landing. The product, then a connect step, then the console — three screens
// worth of job that the console should not have to hold at once.
//
// The connect form is a setup helper, not a credential store. Nothing typed here
// is transmitted, persisted, or sent to the model: the engine reads its database
// URLs from its own environment, which is the whole reason the model never sees a
// connection string. What this screen does is resolve the values into the exact
// environment the engine expects, so the operator can copy it rather than hunt
// through a README.
import { useState } from 'react'

// Dummy by design. Real credentials never belong in a form that will be filmed,
// and these are shaped like the real thing so the screen can be checked without
// anyone typing a secret on camera.
const SAMPLE = {
  live: 'postgres://app:••••••••@db.internal:5432/app',
  shadow: 'postgres://app:••••••••@db.internal:5432/app_shadow',
  key: 'gsk_••••••••••••••••••••••••',
}

type Props = { onEnter: (statement: string) => void }

export function Landing({ onEnter }: Props) {
  const [live, setLive] = useState(SAMPLE.live)
  const [shadow, setShadow] = useState(SAMPLE.shadow)
  const [key, setKey] = useState(SAMPLE.key)
  const [statement, setStatement] = useState("DELETE FROM users WHERE last_active < '2025-01-01'")
  const [shown, setShown] = useState(false)

  const masked = (v: string) => v.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••••••@')

  return (
    <main className="landing">
      <section className="landing-claim">
        <p className="landing-eyebrow">The approval layer for destructive database changes</p>
        <h1>
          An approval that shows you the command instead of the consequence
          is <em>a consent form</em>.
        </h1>
        <p className="landing-stand">
          Countersign runs your statement inside a shadow transaction, counts every row it would
          take through the real foreign keys, proves the rollback against committed state, and only
          then lets an approve control exist.
        </p>
      </section>

      <section className="landing-connect">
        <h2 className="t-label">Connect your database</h2>
        <p className="landing-note">
          The engine reads these from its own environment — nothing typed here is sent anywhere,
          stored, or shown to the model. The fields are pre-filled with dummy values so this screen
          can be checked without a real credential on screen.
        </p>

        <div className="connect-grid">
          <label className="connect-field">
            <span className="t-label">Live database</span>
            <input className="t-data" value={live} onChange={(e) => setLive(e.target.value)} spellCheck={false} />
            <span className="connect-hint">where the change would land</span>
          </label>

          <label className="connect-field">
            <span className="t-label">Shadow database</span>
            <input className="t-data" value={shadow} onChange={(e) => setShadow(e.target.value)} spellCheck={false} />
            <span className="connect-hint">a copy — the undo is replayed here against committed state</span>
          </label>

          <label className="connect-field">
            <span className="t-label">Model key</span>
            <input className="t-data" type="password" value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} />
            <span className="connect-hint">held by the harness, never by the engine</span>
          </label>
        </div>

        <button type="button" className="linkish connect-reveal" onClick={() => setShown((s) => !s)}>
          {shown ? 'hide the resolved environment' : 'show the resolved environment'}
        </button>

        {shown && (
          <pre className="connect-env t-data">{[
            `LIVE_DATABASE_URL=${masked(live)}`,
            `SHADOW_DATABASE_URL=${masked(shadow)}`,
            `COUNTERSIGN_PORT=8977`,
            '',
            '# the model key belongs to TrueForge, not to the engine:',
            '# Settings → Providers → add your key there',
          ].join('\n')}</pre>
        )}
      </section>

      <section className="landing-start">
        <h2 className="t-label">The change to measure</h2>
        <form
          className="landing-form"
          onSubmit={(e) => { e.preventDefault(); if (statement.trim()) onEnter(statement.trim()) }}
        >
          <input
            className="submit-input t-data"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            aria-label="The statement to measure"
            spellCheck={false}
          />
          <button type="submit" className="submit-go">Measure it</button>
        </form>
        <p className="landing-note">Nothing runs until you countersign.</p>
      </section>

      <section className="landing-about">
        <h2 className="t-label">What it does</h2>
        <div className="about-grid">
          <div>
            <h3>It measures instead of estimating</h3>
            <p>
              The statement runs for real inside <span className="t-data">BEGIN … ROLLBACK</span> on
              your database. Per-table counts come from the executed plan, walked through every
              foreign key the schema actually declares, each edge labelled with its real
              <span className="t-data"> ON DELETE</span> semantics. Nothing is predicted.
            </p>
          </div>
          <div>
            <h3>It proves the undo before the commit</h3>
            <p>
              The rollback is generated from pre-image snapshots, then tested like code: the change
              is applied to a shadow copy and committed, the undo runs against that committed state,
              and the exact primary keys have to come back. If they do not, the console says so and
              no approve control appears.
            </p>
          </div>
          <div>
            <h3>Code decides, not the model</h3>
            <p>
              A deterministic rules engine reads the measurement and returns pass or fail — row
              limits, protected tables, undo verification. There is no model anywhere in the verdict
              path. The agent proposes; only code blesses.
            </p>
          </div>
          <div>
            <h3>The approval is a fingerprint, not a click</h3>
            <p>
              What you countersign is a hash of the exact rows you were shown, and the commit deletes
              by that key list alone. Rows that started matching after the measurement void the
              approval instead of dying with it. It expires, because a count you read two minutes ago
              is not a count.
            </p>
          </div>
        </div>
        <p className="landing-note">
          Your database credentials stay in the engine process. The model receives measurements and a
          one-shot token — never a connection string.
        </p>
      </section>
    </main>
  )
}
