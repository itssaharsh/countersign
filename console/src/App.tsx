// The console. DESIGN.md §3: a 56px header, two columns — transcript left,
// dossier right — and a gate bar fixed to the bottom that never scrolls away.
//
// Behind all of it, the stage: a three.js field of points whose geometry is the
// phase (§11). The two are not alternatives. The stage carries what the numbers
// mean and the console carries the numbers, and a judge has to be able to read
// the second while the first is moving.
import { useEffect, useState } from 'react'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, simulationFor, phaseFor } from './state'
import { useFreshness } from './experience/useFreshness'
import { Header } from './shell/Header'
import { Transcript } from './transcript/Transcript'
import { Dossier } from './shell/Dossier'
import { Cover } from './shell/Cover'
import { Landing } from './shell/Landing'
import { Experience } from './experience/Experience'
import { GateBar } from './gate/GateBar'

/**
 * Two surfaces. The landing carries the product and the connect step; the console
 * carries the run. They do not share a screen — a landing that also holds a
 * transcript, a blast radius and a gate is congested exactly when the operator
 * needs to read carefully. Entering is a real navigation so the back button works
 * and the console never inherits the landing's scroll position.
 */
function useRoute(): [string, (p: string) => void] {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return [path, (p: string) => {
    // Keep the query string across the navigation. Judge mode and the deployed
    // demo carry their replay sources there, and dropping them on the way to /run
    // loses replayAfter, so countersigning never switches to the post commit
    // snapshot and the receipt never arrives.
    window.history.pushState({}, '', p + window.location.search)
    // A navigation starts at the top. Without this the console opens at whatever
    // depth the landing was scrolled to, which puts the reader halfway down a
    // section they have not seen the top of.
    window.scrollTo(0, 0)
    setPath(p)
  }]
}

export default function App() {
  const { feed, running, pending, send, respond, answer, startOver, replayReleased } = useHarness()
  const [path, go] = useRoute()
  // Judge mode and a resumed session both land straight in the console: a replay
  // has nothing to connect, and a session already underway must not be sent back
  // to a setup screen it has already passed.
  const params = new URLSearchParams(window.location.search)
  const demo = import.meta.env.VITE_DEMO_REPLAY === '1'
  const skipLanding = params.has('replay') || params.has('replayEvents') || feed.length > 0 || pending.length > 0
  // The demo build arms its replay at mount, so those parameters are always
  // present and would send every visitor straight past the landing. In that
  // build the root path is the landing regardless; the replay streams behind it
  // and is already holding at the gate by the time anyone walks in.
  const onLanding = path === '/' && (demo || !skipLanding)
  // Judge mode: ?replayEvents=… holds at the gate; once countersigned, engine state comes
  // from ?replayAfter=… (the post-commit snapshot of the same recorded run).
  const replayAfter = new URLSearchParams(window.location.search).get('replayAfter') ?? undefined
  const engine = useEngineState(1500, replayReleased ? replayAfter : undefined)
  // While an approval is pending the console shows the simulation that approval names
  // (args.simulation_id); a gate without a loaded, matching simulation stays BLOCKED.
  const gated = pending.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const sim = gated ? simulationFor(engine, (gated.args as { simulation_id?: unknown })?.simulation_id) : activeSimulation(engine)
  const phase = phaseFor(sim, pending.length > 0, running)
  const { left, elapsed, fraction } = useFreshness(sim)

  const [modelName, setModelName] = useState('')
  useEffect(() => {
    fetch('/api/v1/agents').then((r) => r.json()).then((d) => {
      const a = (d?.data ?? []).find((x: { name: string }) => x.name === 'countersign')
      if (a?.manifest?.model?.name) setModelName(String(a.manifest.model.name).split('/').pop() ?? '')
    }).catch(() => {})
  }, [])

  // Nothing has been said in this browser. Either it is a cold open, or the page
  // was loaded against an engine that already holds a run — a reload, a second
  // tab, a judge opening the URL after the demo. Both leave the transcript with
  // nothing in it, and a 380px column reserved for one grey sentence beside a
  // full-height dossier is dead space, not a layout.
  const noFeed = feed.length === 0 && pending.length === 0
  // The cold open is the one that gets the claim. A loaded run is not cold: that
  // operator has a receipt to read, not a pitch.
  const cover = noFeed && phase === 'IDLE'
  const dossier = (
    <Dossier
      phase={phase}
      sim={sim}
      running={running}
      approvalOpen={pending.some((a) => a.kind !== 'question')}
      questionOpen={pending.some((a) => a.kind === 'question')}
      demo={demo}
      onSend={send}
    />
  )

  if (onLanding) {
    return (
      <div className="console is-landing">
        <Experience phase={phase} sim={sim} freshness={fraction} />
        <Header
          phase={phase}
          waiting={false}
          running={false}
          modelName={modelName}
          engineOnline={Boolean(engine.backends.live)}
          canStartOver={false}
          onStartOver={startOver}
        />
        <Landing
          demo={demo}
          onEnter={(statement) => {
            go('/run')
            // A deployed demo has no harness to send to; the recorded run is
            // already streaming. Sending would surface a connection error that
            // says nothing true about the product.
            if (!demo) send(statement)
          }}
        />
      </div>
    )
  }

  return (
    <div className="console">
      {/* Fixed behind everything, its own layer, never in the flow. */}
      <Experience phase={phase} sim={sim} freshness={fraction} />
      <Header
        phase={phase}
        waiting={pending.length > 0}
        running={running}
        modelName={modelName}
        engineOnline={Boolean(engine.backends.live)}
        canStartOver={feed.length > 0 || pending.length > 0}
        onStartOver={startOver}
      />
      <div className={`console-body${noFeed ? ' is-solo' : ''}${cover ? ' is-cover' : ''}`}>
        {/* Two columns are the working layout: a transcript beside the evidence it
            produced. The second column arrives with the first agent event. */}
        {!noFeed && <Transcript feed={feed} pending={pending} />}
        {cover ? (
          <Cover>{dossier}</Cover>
        ) : (
          <>
            {/* Not cold, but nothing in this browser said it: say where the record
                came from rather than showing an empty transcript heading beside it. */}
            {noFeed && (
              <p className="loaded-note">
                Loaded from the engine. The agent transcript belongs to a session this browser
                does not have, so only the record is shown.
              </p>
            )}
            {dossier}
          </>
        )}
      </div>
      <GateBar
        sim={sim}
        pending={pending}
        freshnessLeft={left}
        freshnessElapsed={elapsed}
        respond={respond}
        answer={answer}
      />
    </div>
  )
}
