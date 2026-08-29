import { useEffect, useState } from 'react'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, phaseFor } from './state'
import { Experience } from './experience/Experience'
import { Overlay } from './experience/Overlay'
import { useFreshness } from './experience/useFreshness'

export default function App() {
  const { feed, running, pending, send, respond } = useHarness()
  const engine = useEngineState()
  const sim = activeSimulation(engine)
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
