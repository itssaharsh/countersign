// The console's connection to TrueForge — built directly on @truefoundry/trueforge-sdk,
// speaking the documented protocol: sessions, streamed turns, delta merging, and the
// pause/resume approval events. No wrapper; this IS the harness surface.
import { useCallback, useRef, useState } from 'react'
import { TrueForge, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk'

const client = new TrueForge({ baseUrl: '/', timeoutInSeconds: 600 })

export type FeedItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; threadId: string; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; threadId: string; name: string; args: string; status: 'running' | 'done' | 'error'; resultPreview?: string }
  | { kind: 'thread'; id: string; title: string; done: boolean }
  | { kind: 'system'; id: string; text: string }

export type PendingApproval = {
  threadId: string
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

type TurnEvent = Record<string, any>

export function useHarness() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [running, setRunning] = useState(false)
  const [pending, setPending] = useState<PendingApproval[]>([])
  const sessionRef = useRef<string | null>(null)
  const eventsRef = useRef<Map<string, TurnEvent>>(new Map())

  const upsertFeed = useCallback((item: FeedItem) => {
    setFeed((f) => {
      const i = f.findIndex((x) => x.id === item.id && x.kind === item.kind)
      if (i === -1) return [...f, item]
      const next = f.slice(); next[i] = item; return next
    })
  }, [])

  const consume = useCallback((event: TurnEvent) => {
    const events = eventsRef.current
    if (isEventDelta(event as never)) {
      const base = events.get(event.id)
      if (base) mergeEventDelta(base as never, event as never)
      const b = events.get(event.id)
      if (b?.type === 'model.message') {
        if (b.content) upsertFeed({ kind: 'assistant', id: b.id, threadId: b.threadId ?? 'main', text: b.content, streaming: true })
        // Tool calls accumulate through deltas too — surface them as they form.
        for (const tc of b.toolCalls ?? []) {
          if (tc?.id && (tc.toolInfo?.name || tc.function?.name)) {
            upsertFeed({ kind: 'tool', id: tc.id, threadId: b.threadId ?? 'main', name: tc.toolInfo?.name ?? tc.function?.name, args: tc.function?.arguments ?? '', status: 'running' })
          }
        }
      }
      return
    }
    events.set(event.id, event)
    switch (event.type) {
      case 'model.message': {
        upsertFeed({ kind: 'assistant', id: event.id, threadId: event.threadId ?? 'main', text: event.content ?? '', streaming: false })
        for (const tc of event.toolCalls ?? []) {
          upsertFeed({ kind: 'tool', id: tc.id, threadId: event.threadId ?? 'main', name: tc.toolInfo?.name ?? tc.function?.name ?? 'tool', args: tc.function?.arguments ?? '', status: 'running' })
        }
        break
      }
      case 'tool.message': {
        for (const r of event.results ?? [event]) {
          const id = r.toolCallId ?? event.id
          const preview = typeof r.content === 'string' ? r.content.slice(0, 400) : JSON.stringify(r.content)?.slice(0, 400)
          setFeed((f) => f.map((x) => (x.kind === 'tool' && x.id === id ? { ...x, status: 'done', resultPreview: preview } : x)))
        }
        break
      }
      case 'thread.created':
        upsertFeed({ kind: 'thread', id: event.threadId, title: event.title ?? 'subagent', done: false })
        break
      case 'thread.done':
        setFeed((f) => f.map((x) => (x.kind === 'thread' && x.id === event.threadId ? { ...x, done: true } : x)))
        break
      case 'tool.approval_required': {
        const found: PendingApproval[] = []
        for (const ref of event.toolCalls ?? []) {
          const msg = events.get(ref.sourceEventId)
          const call = msg?.toolCalls?.find((tc: TurnEvent) => tc.id === ref.id)
          found.push({
            threadId: event.threadId ?? 'main',
            toolCallId: ref.id,
            toolName: call?.toolInfo?.name ?? call?.function?.name ?? 'unknown',
            args: safeParse(call?.function?.arguments),
          })
        }
        setPending((p) => [...p, ...found])
        break
      }
    }
  }, [upsertFeed])

  const stream = useCallback(async (input: unknown[]) => {
    setRunning(true)
    try {
      if (!sessionRef.current) {
        const { data: session } = await client.sessions.create({ agent: { name: 'countersign' } })
        sessionRef.current = session.id
      }
      const s = await client.sessions.createTurnStream(sessionRef.current, { input } as never)
      for await (const { data: event } of s.withMetadata()) consume(event as TurnEvent)
    } catch (err) {
      upsertFeed({ kind: 'system', id: `err-${Date.now()}`, text: `stream error: ${String((err as Error).message ?? err)}` })
    } finally {
      setRunning(false)
    }
  }, [consume, upsertFeed])

  const send = useCallback((text: string) => {
    upsertFeed({ kind: 'user', id: `u-${Date.now()}`, text })
    void stream([{ type: 'user.message', content: text }])
  }, [stream, upsertFeed])

  /** Resolve ALL pending approvals with one decision (the demo gates one call at a time). */
  const respond = useCallback((status: 'allow' | 'deny', reason?: string) => {
    const inputs = pending.map((p) => ({
      type: 'user.tool_approval',
      threadId: p.threadId,
      toolCallId: p.toolCallId,
      approval: status === 'allow' ? { status } : { status, reason: reason ?? 'denied by operator' },
    }))
    setPending([])
    void stream(inputs)
  }, [pending, stream])

  return { feed, running, pending, send, respond, sessionId: sessionRef.current }
}

function safeParse(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try { return JSON.parse(s) } catch { return {} }
}
