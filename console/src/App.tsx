import { useEffect, useRef, useState } from 'react'
import { useScroll } from 'framer-motion'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useHarness } from './harness'
import { useEngineState, activeSimulation, simulationFor, phaseFor } from './state'
import { Experience } from './experience/Experience'
import { Cursor, Hero } from './experience/Hero'
import { Story } from './story/Story'
import { Wayfinder } from './story/Wayfinder'
import { useFreshness } from './experience/useFreshness'

gsap.registerPlugin(ScrollTrigger)

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

  // One scroll model for everything: Lenis drives the page, GSAP's ticker drives Lenis,
  // ScrollTrigger listens to Lenis. framer's useScroll reads the same document scroll.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: !reduced })
    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(tick); lenis.destroy() }
  }, [])
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  return (
    <>
      <Cursor />
      <Experience phase={phase} sim={sim} freshness={fraction} scroll={scrollYProgress} />
      <div ref={heroRef}>
        <Hero phase={phase} sim={sim} feed={feed} running={running} pending={pending} freshnessLeft={left} modelName={modelName} engineOnline={Boolean(engine.backends.live)} scroll={scrollYProgress} onSend={send} respond={respond} />
      </div>
      <Story />
      <Wayfinder scroll={scrollYProgress} />
    </>
  )
}
