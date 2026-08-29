// DESIGN.md §3 — the 56px header, ruled 2px beneath. Wordmark on the left, the
// phase track on the right, and the two facts an operator needs about the rig
// behind it: which model is driving, and whether the engine is answering.
import type { Phase } from '../state'
import { PhaseTrack } from '../gate/PhaseTrack'

type Props = {
  phase: Phase
  waiting: boolean
  running: boolean
  modelName: string
  engineOnline: boolean
  canStartOver: boolean
  onStartOver: () => void
}

export function Header(p: Props) {
  return (
    <header className="console-header">
      <div className="brand">
        <span className="brand-mark">COUNTERSIGN</span>
        <span className="brand-sub">the approval layer for destructive database changes</span>
      </div>
      <div className="header-right">
        <PhaseTrack phase={p.phase} waiting={p.waiting} running={p.running} />
        <span className="rig t-data">
          TrueForge{p.modelName ? ` · ${p.modelName}` : ''}
          {/* An offline engine is stated, never implied by an empty panel. */}
          {p.engineOnline ? '' : ' · engine offline'}
        </span>
        {p.canStartOver && (
          <button type="button" className="linkish" onClick={p.onStartOver} title="Forget this session and start clean">
            start over
          </button>
        )}
      </div>
    </header>
  )
}
