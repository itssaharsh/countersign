// DESIGN.md §3 — the left column: what the agent is doing.
//
// Minimal for now: one line per harness event, so nothing the harness reports is
// dropped on the floor. The two-line units, the createdAt timestamps, the
// reasoning and the elapsed counter on an open call land with the transcript
// proper. The column reserves its width either way, so that change adds no
// layout shift (§8).
import { useEffect, useRef } from 'react'
import type { FeedItem } from '../harness'

export function Transcript({ feed }: { feed: FeedItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  // It scrolls; it never steals focus (§3).
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [feed])

  return (
    <section className="col-transcript" aria-label="Agent transcript">
      <h2 className="t-label">Agent transcript</h2>
      {feed.length === 0 ? (
        <p className="panel-empty">Nothing yet. The agent's work appears here as it happens.</p>
      ) : (
        <div className="tx" ref={ref}>
          {feed.map((f) => <Line key={`${f.kind}:${f.id}`} f={f} />)}
        </div>
      )}
    </section>
  )
}

/**
 * The engine reports a refusal or failure as a JSON payload with a top-level
 * `error` key — that is its contract, so read it rather than guessing from the
 * text. A tool that came back with an error is not "done".
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

function Line({ f }: { f: FeedItem }) {
  if (f.kind === 'user') return <div className="tx-line tx-you"><span className="t-label">You</span> {f.text}</div>
  if (f.kind === 'assistant') return f.text ? <div className="tx-line">{f.text}</div> : null
  if (f.kind === 'tool') {
    const failure = failedWith(f.resultPreview)
    const failed = failure !== null || f.status === 'error'
    return (
      <div className={`tx-line tx-tool${failed ? ' tx-failed' : ''}`}>
        {f.name}
        <span className="tx-status">
          {failed ? ' failed' : f.status === 'done' ? ' done' : ' working'}
        </span>
        {/* The arguments are what the call actually asked for — dropping them
            leaves a tool name with no content, which is the consent-form problem
            this project exists to refuse. */}
        {f.args && <div className="tx-args">{f.args.length > 160 ? `${f.args.slice(0, 160)}…` : f.args}</div>}
        {/* What came back. A failure that is only visible as a missing success
            is not visible at all. */}
        {f.resultPreview && (
          <div className="tx-args">{failure ?? (f.resultPreview.length > 200 ? `${f.resultPreview.slice(0, 200)}…` : f.resultPreview)}</div>
        )}
      </div>
    )
  }
  if (f.kind === 'thread') return <div className="tx-line">subagent · {f.title}</div>
  return <div className="tx-line tx-sys">{f.text}</div>
}
