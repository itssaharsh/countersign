// The TrueForge session, rendered as a mission log: user orders, agent reasoning,
// tool calls with live status, subagent threads, and streaming output.
import { useEffect, useRef, useState } from 'react'
import type { FeedItem } from '../harness'

export function MissionFeed({ feed, running, onSend }: {
  feed: FeedItem[]
  running: boolean
  onSend: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [feed])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        {feed.length === 0 && (
          <div className="text-[11px] text-[var(--cs-dim)] mt-6 text-center">
            TRANSMIT AN ORDER TO BEGIN<br />
            <span className="opacity-60">e.g. “Process the change: DELETE FROM users WHERE last_active &lt; '2025-01-01'”</span>
          </div>
        )}
        {feed.map((item) => <Item key={`${item.kind}:${item.id}`} item={item} />)}
        {running && <div className="cs-title text-[10px] cs-blink" style={{ color: 'var(--cs-cyan)' }}>▮ HARNESS RUNNING…</div>}
      </div>
      <form
        className="border-t border-[var(--cs-line)] p-2 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSend(draft.trim()); setDraft('') } }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="transmit an order to the countersign agent…"
          className="flex-1 bg-transparent border border-[var(--cs-line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--cs-cyan)]"
        />
        <button type="submit" disabled={running} className="cs-title text-[11px] px-4 border border-[var(--cs-cyan)] text-[var(--cs-cyan)] disabled:opacity-30">
          SEND
        </button>
      </form>
    </div>
  )
}

function Item({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--cs-amber)' }}>
          <div className="cs-title text-[9px]" style={{ color: 'var(--cs-amber)' }}>OPERATOR</div>
          <div className="text-[13px] whitespace-pre-wrap">{item.text}</div>
        </div>
      )
    case 'assistant':
      if (!item.text) return null
      return (
        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--cs-cyan)' }}>
          <div className="cs-title text-[9px]" style={{ color: 'var(--cs-cyan)' }}>
            AGENT{item.threadId !== 'main' ? ` · ${item.threadId.slice(0, 8)}` : ''}{item.streaming ? ' ▮' : ''}
          </div>
          <div className="text-[12px] whitespace-pre-wrap leading-5 text-[var(--cs-text)]">{item.text}</div>
        </div>
      )
    case 'tool': {
      const color = item.status === 'done' ? 'var(--cs-green)' : item.status === 'error' ? 'var(--cs-red)' : 'var(--cs-amber)'
      return (
        <div className="pl-2">
          <div className="cs-title text-[10px]" style={{ color }}>
            {item.status === 'done' ? '⏺' : '◌'} {item.name}
            <span className="text-[var(--cs-dim)] ml-2 normal-case">{truncate(item.args, 90)}</span>
          </div>
          {item.resultPreview && (
            <div className="text-[10px] text-[var(--cs-dim)] pl-4 truncate">{truncate(item.resultPreview, 140)}</div>
          )}
        </div>
      )
    }
    case 'thread':
      return (
        <div className="cs-title text-[10px] pl-2" style={{ color: item.done ? 'var(--cs-green)' : 'var(--cs-cyan)' }}>
          {item.done ? '✓' : '↳'} SUBAGENT · {item.title}
        </div>
      )
    case 'system':
      return <div className="text-[10px] text-[var(--cs-red)] pl-2">{item.text}</div>
  }
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s }
