import { useEffect, useState } from 'react'
import type { Simulation } from '../state'

export const FRESHNESS_SECONDS = 120
const LOAD_TIME = Date.now()
const REPLAY_MODE = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('replay') || new URLSearchParams(window.location.search).has('replayEvents'))

/** Seconds of measurement freshness left. Replay mode anchors old timestamps to page load. */
export function useFreshness(sim: Simulation | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  if (!sim?.fingerprint) return { left: FRESHNESS_SECONDS, fraction: 1, elapsed: 0 }
  const raw = new Date(sim.fingerprint.measured_at).getTime()
  const measuredAt = REPLAY_MODE && raw < LOAD_TIME - 10 * 60_000 ? LOAD_TIME : raw
  // `elapsed` is not `FRESHNESS_SECONDS - left`: left clamps at zero, and the STALE
  // screen has to say how long ago the rows were actually counted.
  const elapsed = Math.max(0, (now - measuredAt) / 1000)
  const left = Math.max(0, FRESHNESS_SECONDS - elapsed)
  return { left, fraction: left / FRESHNESS_SECONDS, elapsed }
}
