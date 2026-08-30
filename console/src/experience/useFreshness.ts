import { useEffect, useState } from 'react'
import type { Simulation } from '../state'

// How long a measurement stays signable. 120s fits a local database, where an
// investigation takes about twenty seconds. Against a remote one it can take
// seventy, and most of the window is gone before the gate even opens — so a
// hosted deployment raises this rather than handing the operator ten seconds to
// read a blast radius.
//
// ?freshness=<seconds> overrides both, for one specific job: filming. Shots 3 to
// 6 all have to happen inside one window, and 120s is enough to countersign but
// not enough to also frame, scroll and re-take. The parameter only widens what
// the operator is shown — the engine still refuses a commit against a stale
// fingerprint, because that check lives on the server and cannot be moved by a
// query string.
function configuredWindow(): number {
  const fallback = Number(import.meta.env.VITE_FRESHNESS_SECONDS ?? 120)
  if (typeof window === 'undefined') return fallback
  const raw = new URLSearchParams(window.location.search).get('freshness')
  if (raw === null) return fallback
  const n = Number(raw)
  // A non-number or a nonsense value keeps the build's window rather than
  // silently producing a gate that never opens or never closes.
  return Number.isFinite(n) && n >= 5 && n <= 3600 ? n : fallback
}

export const FRESHNESS_SECONDS = configuredWindow()
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
