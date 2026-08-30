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
    </main>
  )
}
