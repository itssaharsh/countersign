// DESIGN.md §3 — the left column: what the agent is doing.
//
// The unit is a harness event, not an imagined tool call (§9 A1). The real stream for a
// complete run is two tool calls — `run_investigation`, then `commit_change` — each
// reaching the console through TrueForge's `call_tool` meta-tool and unwrapped by the
// harness. This renders exactly what arrives, in the order it arrives:
//
//   the model's reasoningContent, in --graphite — the only thing on screen during the
//   first seconds of a turn; then the call, --ink, with its unwrapped name and an elapsed
//   counter while it is open; then the result on tool.response.
//
// Two honesty rules run through the whole file:
//
//   Timestamps are copied, never computed. Every stamp on screen is some event's own
//   createdAt, carried through the harness untouched and stamped into data-ts so the
//   claim is machine-checkable. An event without one gets blank space the width of a
//   stamp — never a guess (§3).
//
//   Waiting is not working (§4). While TrueForge holds the turn on a gate, the open call
//   says `waiting on you`. A running indicator over a paused harness is the exact lie
//   this project exists to refuse.
import { useEffect, useRef, useState } from 'react'
import type { FeedItem, PendingApproval } from '../harness'

export function Transcript({ feed, pending }: { feed: FeedItem[]; pending: PendingApproval[] }) {
  const { now, openedAt } = useElapsedClock(feed)
  const box = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)

  // Follow the tail only when the operator is already at it. It scrolls; it never
  // steals focus (§3) — this moves scrollTop and nothing else.
  useEffect(() => {
    const el = box.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [feed])

  const gatedIds = new Set(pending.map((p) => p.toolCallId))

  return (
    <section className="col-transcript" aria-label="Agent transcript">
      <h2 className="t-label">Agent transcript</h2>
      <div
        className="tx"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {feed.length === 0 && <p className="panel-empty">Nothing yet. The agent's work appears here as it happens.</p>}
        {feed.map((item) => {
          switch (item.kind) {
            // Countersign talking about the run, not the run itself — body face (§2).
            case 'system':
              return <p key={`s-${item.id}`} className="tx-line tx-said">{item.text}</p>

            // The submitted statement. Data for the type rule even though an operator
            // typed it: it is the statement, not Countersign's description of it (§2).
            case 'user':
              return (
                <div key={`u-${item.id}`} className="tx-line">
                  <div className="tx-head"><Stamp at={item.createdAt} /><span className="tx-said tx-role">order</span></div>
                  <p className="tx-body tx-ink">{item.text}</p>
                </div>
              )

            case 'thread':
              return (
                <div key={`h-${item.id}`} className="tx-line">
                  <div className="tx-head">
                    <Stamp at={item.createdAt} />
                    <span className="tx-said tx-role">{item.done ? 'subagent done' : 'subagent'}</span>
                    <span className="tx-ink">{item.title}</span>
                  </div>
                </div>
              )

            case 'assistant':
              if (!item.reasoningContent && !item.text) return null
              return (
                <div key={`a-${item.id}`} className="tx-line">
                  {item.reasoningContent && (
                    <>
                      <div className="tx-head"><Stamp at={item.createdAt} /><span className="tx-said tx-role">thinking</span></div>
                      <p className="tx-body tx-graphite">{item.reasoningContent}</p>
                    </>
                  )}
                  {item.text && (
                    <>
                      <div className="tx-head"><Stamp at={item.createdAt} /><span className="tx-said tx-role">reply</span></div>
                      <p className="tx-body tx-ink">{item.text}</p>
                    </>
                  )}
                </div>
              )

            // The two-line unit: the call, then the result.
            case 'tool': {
              const open = item.status === 'running'
              const waiting = open && gatedIds.has(item.id)
              const ms = elapsed(item, openedAt, now)
              return (
                <div key={`t-${item.id}`} className={`tx-line tx-call${failedWith(item.resultPreview) ? ' tx-call-failed' : ''}`} data-tool={item.name} data-failed={failedWith(item.resultPreview) ? 'true' : undefined}>
                  <div className="tx-head">
                    <Stamp at={item.createdAt} />
                    <span className="tx-tool" title={redact(item.args) || undefined}>{item.name}</span>
                    {ms != null && (
                      // §6 — a number changing, not an animation, and exempt from the budget.
                      // It is the honest answer to "is it stuck?" across the 16.9s in which
                      // run_investigation emits nothing at all.
                      <span className="tx-elapsed" data-elapsed={String(ms)} aria-live="off">{duration(ms)}</span>
                    )}
                  </div>
                  <div className="tx-head">
                    <Stamp at={item.resultAt} />
                    <span className="tx-arrow" aria-hidden="true">{open ? '→' : '←'}</span>
                    {open
                      ? <span className={waiting ? 'tx-said tx-waiting' : 'tx-said tx-graphite'}>{waiting ? 'waiting on you' : 'working'}</span>
                      : (() => {
                          // The engine reports a refusal or failure as a payload with a
                          // top-level `error` key — its contract, so read it rather than
                          // guessing from the text. A call that came back with an error is
                          // not a result: saying "done" for it hides the only thing that
                          // matters. Graphite, not seal; the seal belongs to the
                          // destructive count and the countersign control alone.
                          const failure = failedWith(item.resultPreview)
                          return failure
                            ? <span className="tx-result tx-failed" title={redact(item.resultPreview)}>failed · {redact(failure)}</span>
                            : <span className="tx-result tx-graphite" title={redact(item.resultPreview)}>{redact(flatten(item.resultPreview))}</span>
                        })()}
                  </div>
                </div>
              )
            }
          }
        })}
      </div>
    </section>
  )
}

/**
 * One event's own createdAt, printed and tagged. `data-ts` carries the raw ISO string the
 * harness received so that "this timestamp is real" can be checked against the recorded
 * fixture rather than eyeballed. No stamp is rendered for an event that has none.
 */
function Stamp({ at }: { at?: string }) {
  if (!at) return <span className="tx-stamp" aria-hidden="true" />
  const t = Date.parse(at)
  if (Number.isNaN(t)) return <span className="tx-stamp" aria-hidden="true" />
  return <time className="tx-stamp" dateTime={at} data-ts={at}>{clock(t)}</time>
}

function clock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * How long the call has been open, in ms, or null when it cannot be said honestly.
 *
 * A closed call is the distance between two recorded stamps — the call's createdAt and its
 * response's — so a replay shows the 16.9 seconds run_investigation actually took.
 *
 * An open call has no second stamp yet, so this is wall-clock time since the console saw
 * the call open. In a live run that is the same measurement; in a replay of a run recorded
 * on another day it is the only one that means anything, and it is a duration, not a
 * timestamp: nothing derived from it is ever printed as a time of day.
 */
function elapsed(item: Extract<FeedItem, { kind: 'tool' }>, openedAt: Map<string, number>, now: number): number | null {
  if (item.status !== 'running') {
    if (!item.createdAt || !item.resultAt) return null
    const a = Date.parse(item.createdAt), b = Date.parse(item.resultAt)
    return Number.isNaN(a) || Number.isNaN(b) || b < a ? null : b - a
  }
  const seen = openedAt.get(item.id)
  return seen == null ? null : Math.max(0, now - seen)
}

function duration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

/** A tool result is pretty-printed JSON. Collapse its whitespace so it reads as one
 *  clamped line; the full preview stays on the title. Nothing is summarised or reworded. */
/**
 * The engine's failure contract: a tool response whose payload is JSON with a
 * top-level `error` string. Returns the reason, or null when the call succeeded.
 */
function failedWith(preview: string | undefined): string | null {
  if (!preview) return null
  try {
    const parsed = JSON.parse(preview) as { error?: unknown }
    return typeof parsed?.error === 'string' ? parsed.error : null
  } catch {
    return null
  }
}

/**
 * Capability values must not reach the screen. `undo_token` authorises a rollback
 * against the live database, and the transcript renders tool arguments and results
 * verbatim — so a recorded demo would put a working credential on video. Redacted
 * at the point of display, which protects every source at once: live runs, replays,
 * and any screenshot taken of either.
 */
const SECRET_KEYS = /(token|secret|password|api[_-]?key|authorization)/i
export function redact(text: string | undefined): string {
  if (!text) return ''
  return text
    // "undo_token": "…"  and  undo_token=…  in any escaping the payload arrives in
    .replace(/(\\?"?[a-z_]*(?:token|secret|password|api[_-]?key)[a-z_]*\\?"?\s*[:=]\s*\\?"?)([^",}\s\\]{6,})/gi,
      (_m, head: string) => `${head}<redacted>`)
    // bare credential shapes, wherever they appear in prose
    .replace(/\bgsk_[A-Za-z0-9]{20,}/g, 'gsk_<redacted>')
    .replace(/\bsk-[A-Za-z0-9]{20,}/g, 'sk-<redacted>')
}
export { SECRET_KEYS }

function flatten(s?: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The wall clock, ticking only while a call is open, plus the instant the console first
 * saw each open call. Both are readings of a clock outside React, so both are taken in an
 * effect: nothing about the transcript's content is derived here, only how long the
 * operator has been looking at a call that has not answered yet.
 */
function useElapsedClock(feed: FeedItem[]) {
  const [clock, setClock] = useState(() => ({ now: Date.now(), openedAt: new Map<string, number>() }))
  const anyOpen = feed.some((x) => x.kind === 'tool' && x.status === 'running')

  useEffect(() => {
    setClock((c) => {
      const now = Date.now()
      let openedAt = c.openedAt
      for (const x of feed) {
        if (x.kind === 'tool' && x.status === 'running' && !openedAt.has(x.id)) {
          if (openedAt === c.openedAt) openedAt = new Map(openedAt)
          openedAt.set(x.id, now)
        }
      }
      return openedAt === c.openedAt && c.now === now ? c : { now, openedAt }
    })
  }, [feed])

  useEffect(() => {
    if (!anyOpen) return
    const t = window.setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 100)
    return () => window.clearInterval(t)
  }, [anyOpen])

  return clock
}
