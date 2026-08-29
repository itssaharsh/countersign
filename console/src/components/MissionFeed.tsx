// The TrueForge session as a mission log — operator orders, agent reasoning,
// tool calls with live status, subagent threads — rendered as glass cards.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FeedItem } from '../harness'

export function MissionFeed({ feed, running, onSend }: { feed: FeedItem[]; running: boolean; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [feed])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto cs-scroll px-5 pb-3 space-y-2.5">
        {feed.length === 0 && (
          <div className="mt-10 text-center">
            <div className="t-display italic text-[24px]" style={{ color: 'var(--cs-ink-dim)' }}>Transmit an order to begin.</div>
            <div className="t-mono text-[11px] mt-3 max-w-[46ch] mx-auto leading-5" style={{ color: 'var(--cs-ink-faint)' }}>
              e.g. Process this change request: DELETE FROM users WHERE last_active &lt; '2025-01-01'
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {feed.map((item) => (
            <motion.div key={`${item.kind}:${item.id}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              <Item item={item} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <form
        className="px-4 pb-4 pt-2 flex gap-2 shrink-0"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSend(draft.trim()); setDraft('') } }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="transmit an order to the countersign agent…"
          className="flex-1 rounded-full px-5 py-3 text-[13.5px] outline-none transition-shadow"
          style={{ background: '#fff', border: '1px solid var(--cs-line)', color: 'var(--cs-ink)', boxShadow: '0 0 0 0 rgba(124,92,255,0)' }}
          onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124,92,255,0.18)')}
          onBlur={(e) => (e.currentTarget.style.boxShadow = '0 0 0 0 rgba(124,92,255,0)')}
        />
        <button type="submit" disabled={running}
          className="btn btn-primary text-[13px] px-6 disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  )
}

function Item({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="ml-10 rounded-3xl rounded-tr-md px-4 py-3" style={{ background: 'rgba(255,176,32,0.12)', border: '1px solid rgba(255,176,32,0.35)' }}>
          <div className="t-label mb-1" style={{ color: '#b45309' }}>Operator</div>
          <div className="text-[13.5px] leading-6 whitespace-pre-wrap">{item.text}</div>
        </div>
      )
    case 'assistant':
      if (!item.text) return null
      return (
        <div className="mr-8 rounded-3xl rounded-tl-md px-4 py-3" style={{ background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.22)' }}>
          <div className="t-label mb-1" style={{ color: 'var(--cs-violet)' }}>
            Agent{item.threadId !== 'main' ? ` · ${item.threadId.slice(0, 8)}` : ''}{item.streaming ? ' ▮' : ''}
          </div>
          <div className="text-[13px] leading-6 whitespace-pre-wrap" style={{ color: 'var(--cs-ink)' }}>{renderLite(item.text)}</div>
        </div>
      )
    case 'tool': {
      const done = item.status === 'done'
      const color = done ? 'var(--cs-green)' : item.status === 'error' ? 'var(--cs-coral)' : 'var(--cs-amber)'
      return (
        <div className="mr-8 pl-1">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: `${color}14`, border: `1px solid ${color}55` }}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${done ? '' : 'cs-pulse'}`} style={{ background: color }} />
            <span className="t-hud text-[10.5px]" style={{ color }}>{item.name}</span>
            <span className="t-mono text-[10.5px] max-w-[38ch] truncate" style={{ color: 'var(--cs-ink-faint)' }}>{item.args}</span>
          </div>
          {item.resultPreview && (
            <div className="t-mono text-[10.5px] mt-1 ml-3 truncate" style={{ color: 'var(--cs-ink-faint)' }}>↳ {item.resultPreview}</div>
          )}
        </div>
      )
    }
    case 'thread':
      return <div className="t-hud text-[10.5px] pl-2" style={{ color: item.done ? 'var(--cs-green)' : 'var(--cs-blue)' }}>{item.done ? '✓' : '↳'} subagent · {item.title}</div>
    case 'system': {
      const bad = /error/i.test(item.text)
      return <div className="t-mono text-[11px] rounded-lg px-3 py-2" style={{ color: bad ? 'var(--cs-coral)' : 'var(--cs-ink-dim)', background: bad ? 'rgba(255,90,95,0.08)' : 'rgba(23,25,35,0.04)' }}>{item.text}</div>
    }
  }
}

/** Tiny markdown: **bold**, `code`, and "- " bullets — enough for agent summaries. */
function renderLite(text: string) {
  const clean = text.replace(/^---\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  return clean.split('\n').map((line, i) => {
    const bullet = line.startsWith('- ')
    const parts = (bullet ? line.slice(2) : line).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={j} style={{ color: 'var(--cs-ink)', fontWeight: 600 }}>{seg.slice(2, -2)}</strong>
      if (seg.startsWith('`') && seg.endsWith('`')) return <code key={j} className="t-mono text-[12px] px-1 rounded" style={{ background: 'rgba(124,92,255,0.10)', color: 'var(--cs-violet)' }}>{seg.slice(1, -1)}</code>
      return seg
    })
    return <div key={i} style={bullet ? { paddingLeft: 14, textIndent: -10 } : undefined}>{bullet ? '• ' : ''}{parts}</div>
  })
}
