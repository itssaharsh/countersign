// DESIGN.md §4 — hold to countersign, not click. 1200ms of sustained intent;
// release early and it resets. Keyboard parity is required, not optional: focus
// the control and hold Enter for the same duration with the same fill.
//
// prefers-reduced-motion replaces the continuous fill with a stepped 4-segment
// progress. The hold duration does not change — the point of the hold is intent,
// not animation, so reducing motion must not reduce the commitment it takes.
import { useCallback, useEffect, useRef, useState } from 'react'

export const HOLD_MS = 1200
const STEPS = 4

export function useHold(onComplete: () => void, enabled: boolean, gateKey?: string) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const raf = useRef<number | null>(null)
  const startedAt = useRef(0)
  const done = useRef(false)
  // onComplete is read through a ref so a re-rendered parent cannot swap the
  // handler mid-hold, and so the effect below never re-subscribes because of it.
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete
  // `enabled` is read through a ref inside the frame loop as well as at start.
  // A hold begun at t=119s must not land an approval at t=120.2s, after the
  // control has withdrawn because the measurement went stale — that would
  // authorise an irreversible commit on evidence the console already rejected.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setHolding(false)
    if (!done.current) setProgress(0)
  }, [])

  const start = useCallback(() => {
    if (!enabled || holding || done.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setHolding(true)
    startedAt.current = performance.now()
    const tick = () => {
      if (!enabledRef.current) { stop(); return }
      const raw = Math.min(1, (performance.now() - startedAt.current) / HOLD_MS)
      // Stepped, not smooth: the operator still sees four discrete commitments.
      setProgress(reduced ? Math.floor(raw * STEPS) / STEPS : raw)
      if (raw >= 1) {
        done.current = true
        setProgress(1)
        raf.current = null
        setHolding(false)
        completeRef.current()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [enabled, holding, stop])

  // One GateBar serves every gate in a session: commit, then the undo's RESTORE,
  // then anything after. Completion is per-gate, so it resets when the pending
  // approval changes — otherwise the first countersign would leave every later
  // control permanently labelled done and refusing to start.
  //
  // Reset during render rather than in an effect. An effect runs after paint, so
  // the first frame of a new gate would still be carrying the previous gate's
  // completed state, and the control would render as already countersigned.
  const [lastKey, setLastKey] = useState(gateKey)
  if (lastKey !== gateKey) {
    setLastKey(gateKey)
    done.current = false
    if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null }
    setProgress(0)
    setHolding(false)
  }

  // A pointerup outside the control, a blur, or a released key must all reset the
  // hold — otherwise letting go off-target would leave it armed and counting.
  useEffect(() => {
    if (!holding) return
    const cancel = () => stop()
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    }
  }, [holding, stop])

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current) }, [])

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); start() },
    onPointerUp: stop,
    onPointerLeave: stop,
    onKeyDown: (e: React.KeyboardEvent) => {
      // Enter only, and never the browser's auto-repeat — repeat would restart the
      // timer on every keypress and the hold would never complete.
      if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); start() }
    },
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === 'Enter') stop() },
    // Tabbing away mid-hold ends the sustained intent, and the keyup would land on
    // whatever took focus instead. Window blur does not cover that — it only fires
    // when the whole window loses focus.
    onBlur: stop,
  }

  return { progress, holding, complete: done.current, handlers }
}
