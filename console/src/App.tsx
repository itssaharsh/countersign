// The console. DESIGN.md §3: a 56px header, two columns — transcript left,
// dossier right — and a gate bar fixed to the bottom that never scrolls away.
// No stage, no scroll story: the artifact is the operator console.
import { useEffect, useState } from 'react'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, simulationFor, phaseFor } from './state'
import { useFreshness } from './experience/useFreshness'
import { Header } from './shell/Header'
import { Transcript } from './transcript/Transcript'
import { Dossier } from './shell/Dossier'
import { Cover } from './shell/Cover'
import { GateBar } from './gate/GateBar'

export default function App() {
  const { feed, running, pending, send, respond, answer, startOver, replayReleased } = useHarness()
  // Judge mode: ?replayEvents=… holds at the gate; once countersigned, engine state comes
  // from ?replayAfter=… (the post-commit snapshot of the same recorded run).
  const replayAfter = new URLSearchParams(window.location.search).get('replayAfter') ?? undefined
  const engine = useEngineState(1500, replayReleased ? replayAfter : undefined)
  // While an approval is pending the console shows the simulation that approval names
  // (args.simulation_id); a gate without a loaded, matching simulation stays BLOCKED.
  const gated = pending.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const sim = gated ? simulationFor(engine, (gated.args as { simulation_id?: unknown })?.simulation_id) : activeSimulation(engine)
  const phase = phaseFor(sim, pending.length > 0, running)
  const { left, elapsed } = useFreshness(sim)

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
      onSend={send}
    />
  )

  return (
    <div className="console">
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
