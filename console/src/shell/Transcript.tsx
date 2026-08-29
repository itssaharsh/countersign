// DESIGN.md §3 — the left column: what the agent is doing.
//
// Shell only. The column reserves its width now so that when lines begin to
// stream there is no layout shift, which §8 requires. What goes in it — the
// reasoning, the tool call with its elapsed counter, the result, timestamped
// from each event's createdAt — lands with the transcript itself.
import type { FeedItem } from '../harness'

export function Transcript({ feed }: { feed: FeedItem[] }) {
  return (
    <section className="col-transcript" aria-label="Agent transcript">
      <h2 className="t-label">Agent transcript</h2>
      {feed.length === 0 && <p className="panel-empty">Nothing yet. The agent's work appears here as it happens.</p>}
    </section>
  )
}
