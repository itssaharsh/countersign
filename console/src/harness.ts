// The console's connection to TrueForge — built directly on @truefoundry/trueforge-sdk,
// speaking the documented protocol: sessions, streamed turns, delta merging, and the
// pause/resume approval events. No wrapper; this IS the harness surface.
import { useCallback, useEffect, useRef, useState } from 'react'
import { TrueForge, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk'

const client = new TrueForge({ baseUrl: '/', timeoutInSeconds: 600 })
const RESUME_KEY = 'countersign-session'

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
  const turnRef = useRef<{ turnId: string | null; seq: number }>({ turnId: null, seq: 0 })

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
      case 'tool.response': {
        const id = event.toolCallId ?? event.id
        const preview = typeof event.content === 'string' ? event.content.slice(0, 400) : JSON.stringify(event.content)?.slice(0, 400)
        setFeed((f) => f.map((x) => (x.kind === 'tool' && x.id === id ? { ...x, status: 'done', resultPreview: preview } : x)))
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
      for await (const { data: event, id } of s.withMetadata()) {
        if (id != null) turnRef.current.seq = Number(id)
        if ((event as TurnEvent).type === 'turn.created') turnRef.current.turnId = (event as TurnEvent).turnId
        persistResume()
        consume(event as TurnEvent)
      }
    } catch (err) {
      upsertFeed({ kind: 'system', id: `err-${Date.now()}`, text: `stream error: ${String((err as Error).message ?? err)}` })
    } finally {
      setRunning(false)
    }
  }, [consume, upsertFeed])

  const persistResume = useCallback(() => {
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ sessionId: sessionRef.current, turnId: turnRef.current.turnId, seq: turnRef.current.seq }))
    } catch { /* storage unavailable */ }
  }, [])

  // Survive reconnects: if a turn was running when the page died, re-attach to its
  // live stream (subscribeToTurn resumes after the last seen sequence number).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let saved: { sessionId?: string; turnId?: string; seq?: number } | null = null
      try { saved = JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null') } catch { /* ignore */ }
      if (!saved?.sessionId || !saved.turnId) return
      try {
        const { data: turn } = await client.sessions.getTurn(saved.sessionId, saved.turnId)
        if (cancelled) return
        sessionRef.current = saved.sessionId
        turnRef.current = { turnId: saved.turnId, seq: saved.seq ?? 0 }
        if (turn.state?.status === 'running') {
          upsertFeed({ kind: 'system', id: 'resume', text: `⟲ reconnected to running turn ${saved.turnId.slice(0, 8)}… (after seq ${saved.seq})` })
          setRunning(true)
          const stream = await client.sessions.subscribeToTurn(saved.sessionId, saved.turnId, { afterSequenceNumber: saved.seq ?? 0 } as never, { timeoutInSeconds: 600 } as never)
          for await (const { data: event, id } of stream.withMetadata()) {
            if (cancelled) return
            if (id != null) turnRef.current.seq = Number(id)
            consume(event as TurnEvent)
          }
          setRunning(false)
        }
      } catch { /* stale resume state — start fresh */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = useCallback((text: string) => {
    upsertFeed({ kind: 'user', id: `u-${Date.now()}`, text })
    void stream([{ type: 'user.message', content: text }])
  }, [stream, upsertFeed])

  /** Resolve one pending approval by id — or the oldest one when unspecified. */
  const respond = useCallback((status: 'allow' | 'deny', reason?: string, toolCallId?: string) => {
    const target = toolCallId ? pending.filter((p) => p.toolCallId === toolCallId) : pending.slice(0, 1)
    if (!target.length) return
    const inputs = target.map((p) => ({
      type: 'user.tool_approval',
      threadId: p.threadId,
      toolCallId: p.toolCallId,
      approval: status === 'allow' ? { status } : { status, reason: reason ?? 'denied by operator' },
    }))
    setPending((prev) => prev.filter((p) => !target.includes(p)))
    void stream(inputs)
  }, [pending, stream])

  return { feed, running, pending, send, respond, sessionId: sessionRef.current }
}

function safeParse(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try { return JSON.parse(s) } catch { return {} }
}
