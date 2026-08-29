// DESIGN.md §5 — the phase indicator is not decoration, it is the answer to
// "what is it waiting on". Three segments; the active one is --ink with a filled
// dot, past segments --graphite, future segments --rule. Before a change is
// submitted all three are --rule.
//
// §4 — waiting is not working. An approval ends the turn; countersigning starts a
// new one. While the harness is paused on a gate nothing is running, so the track
// says "waiting on you" and never a running indicator.
import type { Phase } from '../state'

const SEGMENTS: Exclude<Phase, 'IDLE'>[] = ['INVESTIGATING', 'DECIDING', 'WITNESSING']

export function PhaseTrack({ phase, waiting, running }: { phase: Phase; waiting: boolean; running: boolean }) {
  const active = SEGMENTS.indexOf(phase as Exclude<Phase, 'IDLE'>)
  return (
    <div className="phase-track" role="status" aria-label={`Phase: ${phase.toLowerCase()}`}>
      {SEGMENTS.map((s, i) => {
        // phase IDLE gives active === -1, so every segment is future. Correct:
        // nothing has been submitted, so no phase has been reached.
        const state = i === active ? 'on' : i < active ? 'past' : 'future'
        return (
          <span key={s} className={`seg ${state}`}>
            <span className="dot" aria-hidden />
            {s}
          </span>
        )
      })}
      <span className="phase-status">
        {waiting ? 'waiting on you' : running ? 'working' : ''}
      </span>
    </div>
  )
}
