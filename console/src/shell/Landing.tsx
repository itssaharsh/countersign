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

type Props = { onEnter: (statement: string) => void; demo?: boolean }

export function Landing({ onEnter, demo = false }: Props) {
  const [live, setLive] = useState(SAMPLE.live)
  const [shadow, setShadow] = useState(SAMPLE.shadow)
  const [key, setKey] = useState(SAMPLE.key)
  const [statement, setStatement] = useState("DELETE FROM users WHERE last_active < '2025-01-01'")
  const [shown, setShown] = useState(false)

  const masked = (v: string) => v.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••••••@')

  return (
    <main className="landing">
      {demo && (
        <p className="demo-banner">
          <b>Demo.</b> This deployment replays a recorded run of the real agent: the same event
          stream, through the same code, holding at the approval the harness actually raised. It is
          not connected to a database. To run it against yours, see the repository.
        </p>
      )}
      <section className="landing-claim">
        <p className="landing-eyebrow">Countersign</p>
        <h1>
          You approved six thousand rows.
          It took <em>43,413</em>.
        </h1>
        <p className="landing-stand">
          That is one real statement against one real database. The extra 37,413 rows were orders
          placed by those users, and payments made against those orders, reached through foreign
          keys the approval prompt never mentioned. Every agent harness ships the same prompt: a
          tool name, a JSON blob, allow or deny. Nobody can answer that honestly.
        </p>
        <p className="landing-stand">
          Countersign answers it for you. Before an approve button exists, it runs your statement
          on your database inside a transaction it rolls back, counts what actually dies through
          every foreign key your schema declares, writes the rollback and proves it restores the
          exact rows, and checks the result against rules you wrote. If any of that fails, there is
          no button.
        </p>
      </section>

      <section className="landing-connect">
        <h2 className="t-label">Connect your database</h2>
        <p className="landing-note">
          The engine reads these from its own environment. Nothing typed here is sent anywhere,
          stored, or shown to the model. The fields hold dummy values so this screen can be read
          without a real credential on it{demo ? ', and this deployment has no engine to configure' : ''}.
        </p>

        <div className="connect-grid">
          <label className="connect-field">
            <span className="t-label">Live database</span>
            <input className="t-data" value={live} onChange={(e) => setLive(e.target.value)} spellCheck={false} />
            <span className="connect-hint">the database the change would touch</span>
          </label>

          <label className="connect-field">
            <span className="t-label">Shadow database</span>
            <input className="t-data" value={shadow} onChange={(e) => setShadow(e.target.value)} spellCheck={false} />
            <span className="connect-hint">a copy, where the rollback is proven</span>
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
          <button type="submit" className="submit-go">{demo ? 'Watch the recorded run' : 'Measure it'}</button>
        </form>
        <p className="landing-note">Nothing runs until you countersign.</p>
      </section>

      <section className="landing-about">
        <h2 className="t-label">What it does</h2>
        <div className="about-grid">
          <div>
            <h3>It measures, it does not estimate</h3>
            <p>
              Your statement runs for real inside <span className="t-data">BEGIN … ROLLBACK</span>.
              The per table counts come from what the database actually did, walked through every
              foreign key your schema declares, each one labelled <span className="t-data">CASCADE</span>,
              <span className="t-data"> SET NULL</span> or <span className="t-data">RESTRICT</span>.
              Nothing here is a guess about what might happen.
            </p>
          </div>
          <div>
            <h3>It proves the undo before you commit</h3>
            <p>
              The rollback is built from snapshots of the rows before they change, then tested like
              code. On a copy of your database, the change is applied and committed, the rollback
              runs against that committed state, and the exact primary keys have to come back. If
              twelve of six thousand fail to return, the screen says so and no button appears.
            </p>
          </div>
          <div>
            <h3>Code decides, not the model</h3>
            <p>
              Your rules are a short file: how many rows may die, which tables must never lose any,
              whether a verified rollback is required. A deterministic engine reads the measurement
              and returns pass or fail. No model sits anywhere in that path. The agent proposes and
              only code approves.
            </p>
          </div>
          <div>
            <h3>You sign specific rows, not a command</h3>
            <p>
              What you countersign is a hash of the exact rows you were shown, and the commit deletes
              by that key list alone. A row that started matching your <span className="t-data">WHERE</span>
              clause while you were reading voids the approval instead of dying with it. The signature
              expires after two minutes, because a count you read two minutes ago is not a count.
            </p>
          </div>
        </div>
        <p className="landing-note">
          Your database credentials stay in the engine process. The model receives measurements and a
          single use token. It never sees a connection string.
        </p>
      </section>
    </main>
  )
}
