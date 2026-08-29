// The console. DESIGN.md §3: a 56px header, two columns — transcript left,
// dossier right — and a gate bar fixed to the bottom that never scrolls away.
// No stage, no scroll story: the artifact is the operator console.
import { useEffect, useState } from 'react'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, simulationFor, phaseFor } from './state'
import { useFreshness } from './experience/useFreshness'
import { Header } from './shell/Header'
import { Transcript } from './shell/Transcript'
import { Dossier } from './shell/Dossier'
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
  const phase = phaseFor(sim, pending.length > 0)
  const { left, elapsed } = useFreshness(sim)

  const [modelName, setModelName] = useState('')
  useEffect(() => {
    fetch('/api/v1/agents').then((r) => r.json()).then((d) => {
      const a = (d?.data ?? []).find((x: { name: string }) => x.name === 'countersign')
      if (a?.manifest?.model?.name) setModelName(String(a.manifest.model.name).split('/').pop() ?? '')
    }).catch(() => {})
  }, [])

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
      <div className="console-body">
        <Transcript feed={feed} />
        <Dossier
          phase={phase}
          sim={sim}
          running={running}
          approvalOpen={pending.some((a) => a.kind !== 'question')}
          questionOpen={pending.some((a) => a.kind === 'question')}
          onSend={send}
        />
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
