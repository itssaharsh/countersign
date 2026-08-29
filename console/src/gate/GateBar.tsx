// DESIGN.md §4 — the signature element.
//
// The Approve control does not exist until it is earned. Not disabled. Not greyed
// out. Absent. Until then the bar carries the fingerprint and a --graphite line
// naming what is still missing — and that missing-line is a blocked state, not a
// loading state: in a healthy run the three preconditions are satisfied together,
// in one tool result, before TrueForge ever pauses. It appears when the gate is
// open and the evidence behind it is not.
//
// Screens handled here: ARMED, REFUSED (§5), STALE (§5), a question gate, and the
// RESTORE variant for the undo — which is itself countersigned, because firing it
// raises a second TrueForge approval rather than acting locally.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PendingApproval } from '../harness'
import type { Simulation } from '../state'
import { useHold } from './useHold'

type Props = {
  sim?: Simulation
  pending: PendingApproval[]
  freshnessLeft: number
  freshnessElapsed: number
  respond: (status: 'allow' | 'deny', reason?: string, toolCallId?: string) => void
  answer: (toolCallId: string, content: string) => void
}

/** Seconds as the operator reads them: "2m 14s", not 134. */
function duration(s: number): string {
  const n = Math.max(0, Math.round(s))
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`
}

export function GateBar(p: Props) {
  const reduced = useReducedMotion()
  const [reason, setReason] = useState('')
  const [answerText, setAnswerText] = useState('')

  const approval = p.pending.find((a) => a.kind !== 'question' && (a.toolName === 'commit_change' || a.toolName === 'fire_undo'))
  const question = p.pending.find((a) => a.kind === 'question')
  const isUndo = approval?.toolName === 'fire_undo'

  // What the operator has not yet been shown. This mirrors the server's own
  // refusal codes rather than guessing: a commit needs blast radius (destructive
  // kinds), a verified undo and a policy PASS; an undo needs a committed change.
  // No loaded simulation for this approval means there is nothing to countersign.
  const missing: string[] = !p.sim
    ? ['its evidence']
    : isUndo
      ? (p.sim.committed ? [] : ['a committed change'])
      : ([
          p.sim.kind === 'destructive-cascade' && !p.sim.fingerprint && 'blast radius',
          !p.sim.undo.verified && 'a proven undo',
          p.sim.policy?.verdict !== 'PASS' && 'a policy pass',
        ].filter(Boolean) as string[])

  // Freshness belongs to the commit fingerprint only. fire_undo is gated by
  // committed state, verification and its one-shot token — never by the
  // pre-commit timer — so the undo gate can never go stale.
  const state: 'BLOCKED' | 'ARMED' | 'STALE' =
    missing.length ? 'BLOCKED' : (!isUndo && p.freshnessLeft <= 0) ? 'STALE' : 'ARMED'

  const armed = Boolean(approval) && state === 'ARMED'
  // An approval and a question can be pending at once, so they need separate
  // identities. A single combined key stays pinned to the approval while
  // questions come and go, and the reset that depends on it never fires.
  const approvalKey = approval?.toolCallId
  const questionKey = question?.toolCallId
  const { progress, holding, complete, handlers } = useHold(
    () => approval && p.respond('allow', undefined, approval.toolCallId),
    armed,
    approvalKey,
  )

  // Both text fields belong to the gate that is open, not to the bar. Carrying a
  // reason across gates would send the previous gate's explanation back to the
  // agent against a different tool call. Reset during render, not in an effect:
  // an effect runs after paint, so the first frame of the new gate would still
  // show — and on submit, send — the previous operator's words.
  const [lastApprovalKey, setLastApprovalKey] = useState(approvalKey)
  if (lastApprovalKey !== approvalKey) {
    setLastApprovalKey(approvalKey)
    setReason('')
  }
  const [lastQuestionKey, setLastQuestionKey] = useState(questionKey)
  if (lastQuestionKey !== questionKey) {
    setLastQuestionKey(questionKey)
    setAnswerText('')
  }

  // The bar's height is content-dependent — a question, a refusal detail and a
  // narrow viewport all add rows — so anything that has to sit clear of it reads
  // the measured height rather than the nominal token. Removed with the legacy
  // hero, which is the only thing that still needs the offset.
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const publish = () => document.documentElement.style.setProperty('--gate-h-actual', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--gate-h-actual') }
  }, [])

  const verb = isUndo ? 'RESTORE' : 'COUNTERSIGN'
  const label = complete ? (isUndo ? 'RESTORED' : 'COUNTERSIGNED') : holding ? 'HOLD…' : `HOLD TO ${verb}`

  const fingerprint = p.sim?.fingerprint
  const deny = () => approval && p.respond('deny', reason || 'denied by operator', approval.toolCallId)

  return (
    <div className="gate-bar" ref={barRef}>
      <div className="inner">
        <div className="gate-left">
          {fingerprint ? (
            <>
              <span className="t-data gate-fp" title={fingerprint.pk_hash}>
                fingerprint {fingerprint.pk_hash.slice(0, 8)}…{fingerprint.pk_hash.slice(-2)}
              </span>
              <span className="gate-scope t-data">
                · scoped to {fingerprint.count.toLocaleString()} root {fingerprint.count === 1 ? 'key' : 'keys'}
              </span>
            </>
          ) : (
            <span className="gate-scope">nothing measured yet</span>
          )}
        </div>

        <div className="gate-right">
          {question ? (
            // A question is not destructive, so it takes no hold — just an answer.
            <form
              className="gate-question"
              onSubmit={(e) => {
                e.preventDefault()
                if (answerText.trim()) { p.answer(question.toolCallId, answerText.trim()); setAnswerText('') }
              }}
            >
              <span className="gate-note">
                the agent asks: {String(
                  (question.args as { question?: unknown }).question ??
                  (question.args as { prompt?: unknown }).prompt ??
                  (question.args as { message?: unknown }).message ??
                  question.toolName,
                )}
              </span>
              <input
                className="gate-input t-data"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="your answer, sent back to the agent"
                aria-label="Answer the agent's question"
              />
              <button type="submit" className="gate-secondary">Answer</button>
              {/* Without an escape, an unanswerable question blocks every later
                  order: the harness refuses send() while anything is pending.
                  Declining resolves it through the question protocol
                  (user.tool_response) — never with an approval response. */}
              <button
                type="button"
                className="gate-secondary"
                onClick={() => {
                  p.answer(question.toolCallId, answerText.trim() || 'declined by operator: not answering this question')
                  setAnswerText('')
                }}
              >
                Decline
              </button>
            </form>
          ) : !approval ? (
            <span className="gate-note">
              {p.sim ? 'no gate open; the harness is not waiting on you' : 'waiting: nothing submitted yet'}
            </span>
          ) : (
            <>
              {state === 'BLOCKED' && (
                <span className="gate-note">waiting: this approval is missing {missing.join(', ')}</span>
              )}
              {state === 'STALE' && (
                <span className="gate-note">
                  these rows were counted {duration(p.freshnessElapsed)} ago. The count is no longer current —
                  deny this gate, then send the order again for a fresh measurement.
                </span>
              )}
              {state === 'ARMED' && !isUndo && p.freshnessLeft <= 30 && (
                <span className="t-data gate-countdown">{Math.ceil(p.freshnessLeft)}s left</span>
              )}
              {state === 'ARMED' && (
                <span className="gate-note">
                  {isUndo
                    ? `+${fingerprint?.count.toLocaleString() ?? '?'} rows come back · one shot, verified on committed state`
                    : `−${fingerprint?.count.toLocaleString() ?? '?'} rows in the fingerprinted set`}
                </span>
              )}

              <input
                className="gate-input t-data"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="reason, sent back to the agent"
                aria-label="Reason, sent back to the agent"
              />
              {/* Deny is always present while a gate is open — the harness holds the
                  turn until it is resolved, and the reason is the operator's only
                  channel back to the agent while it does. Never styled to compete. */}
              <button type="button" className="gate-secondary" onClick={deny}>Deny</button>

              {/* §4 — the control materialises only once earned, and withdraws the
                  same way when the measurement goes stale. */}
              <AnimatePresence>
                {armed && (
                  <motion.button
                    key="hold"
                    type="button"
                    className={`hold ${isUndo ? 'is-undo' : ''} ${complete ? 'is-done' : ''}`}
                    initial={reduced ? false : { scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                    aria-label={`Hold for ${isUndo ? 'restore' : 'countersign'}`}
                    {...handlers}
                  >
                    {/* The fill arrives 80ms behind the shape, so the red is the last
                        thing to appear on screen (§4). */}
                    <span className="hold-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden />
                    {/* The label changes during the hold (HOLD TO … → HOLD… → done).
                        A hidden sizer pins the width to the longest variant: without
                        it the control shrinks under the held pointer, the pointer
                        ends up outside it, and the hold cancels itself. */}
                    <span className="hold-label">
                      <span className="hold-sizer" aria-hidden>{`HOLD TO ${verb}`}</span>
                      <span className="hold-text">{label}</span>
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* §5 REFUSED — the bar names what is missing; the reason belongs in full,
          in the operator's words, with what to do next. No red: nothing
          destructive is being offered, so nothing earns the seal. */}
      {approval && state === 'BLOCKED' && <RefusalDetail sim={p.sim} isUndo={Boolean(isUndo)} />}
    </div>
  )
}

function RefusalDetail({ sim, isUndo }: { sim?: Simulation; isUndo: boolean }) {
  let line: string | null = null

  if (!sim) {
    line = 'The harness is holding an approval whose simulation this console has never seen. Deny it and send the order again.'
  } else if (isUndo && !sim.committed) {
    line = 'Nothing has been committed yet, so there is nothing to restore.'
  } else if (sim.undo.report && !sim.undo.verified) {
    const restored = Number((sim.undo.report as { restored_rows?: unknown }).restored_rows ?? 0)
    const expected = sim.fingerprint?.count ?? 0
    line = expected
      ? `NOT RESTORED BY THE GENERATED ROLLBACK — ${(expected - restored).toLocaleString()} of ${expected.toLocaleString()} rows did not come back in shadow. Countersign is unavailable. Deny this gate and resubmit; the agent will re-measure.`
      : 'NOT RESTORED BY THE GENERATED ROLLBACK. Countersign is unavailable.'
  } else if (sim.policy?.verdict === 'FAIL') {
    const failed = sim.policy.rules.find((r) => !r.pass)
    line = failed ? `Policy failed — ${failed.rule}: ${failed.detail}` : 'Policy failed.'
  } else if (!sim.undo.verified) {
    line = 'The undo has not been verified against committed shadow state yet, so there is nothing proven to countersign against.'
  }

  if (!line) return null
  return <div className="gate-refusal">{line}</div>
}
