import { useEffect, useState } from 'react'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, simulationFor, phaseFor } from './state'
import { Experience } from './experience/Experience'
import { Overlay } from './experience/Overlay'
import { useFreshness } from './experience/useFreshness'

export default function App() {
  const { feed, running, pending, send, respond, replayReleased } = useHarness()
  // Judge mode: ?replayEvents=… holds at the gate; once countersigned, engine state comes
  // from ?replayAfter=… (the post-commit snapshot of the same recorded run).
  const replayAfter = new URLSearchParams(window.location.search).get('replayAfter') ?? undefined
  const engine = useEngineState(1500, replayReleased ? replayAfter : undefined)
  // While an approval is pending the stage shows the simulation that approval names
  // (args.simulation_id); a gate without a loaded, matching simulation stays BLOCKED.
  const gated = pending.find((a) => a.toolName === 'commit_change' || a.toolName === 'fire_undo')
  const sim = gated ? simulationFor(engine, (gated.args as { simulation_id?: unknown })?.simulation_id) : activeSimulation(engine)
  const phase = phaseFor(sim, pending.length > 0)
  const { left, fraction } = useFreshness(sim)
  const [modelName, setModelName] = useState('')
  useEffect(() => {
    fetch('/api/v1/agents').then((r) => r.json()).then((d) => {
      const a = (d?.data ?? []).find((x: { name: string }) => x.name === 'countersign')
      if (a?.manifest?.model?.name) setModelName(String(a.manifest.model.name).split('/').pop() ?? '')
    }).catch(() => {})
  }, [])
  return (
    <>
      <Experience phase={phase} sim={sim} freshness={fraction} />
      <Overlay phase={phase} sim={sim} feed={feed} running={running} pending={pending} freshnessLeft={left} modelName={modelName} engineOnline={Boolean(engine.backends.live)} onSend={send} respond={respond} />
    </>
  )
}
