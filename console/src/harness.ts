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
  const replayGateRef = useRef<(() => void) | null>(null)
  const [replayReleased, setReplayReleased] = useState(false)
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
            const u = unwrapCall(tc.toolInfo?.name ?? tc.function?.name, safeParse(tc.function?.arguments))
            upsertFeed({ kind: 'tool', id: tc.id, threadId: b.threadId ?? 'main', name: u.name, args: u.name !== (tc.toolInfo?.name ?? tc.function?.name) ? JSON.stringify(u.args) : (tc.function?.arguments ?? ''), status: 'running' })
          }
        }
      }
      return
    }
    events.set(event.id, event)
    if (event.type === 'turn.done' && event.state?.status === 'error') {
      upsertFeed({ kind: 'system', id: `turnerr-${event.id}`, text: `turn error: ${String(event.state?.message ?? '').slice(0, 300)}` })
    }
    switch (event.type) {
      case 'model.message': {
        upsertFeed({ kind: 'assistant', id: event.id, threadId: event.threadId ?? 'main', text: event.content ?? '', streaming: false })
        for (const tc of event.toolCalls ?? []) {
          const u = unwrapCall(tc.toolInfo?.name ?? tc.function?.name ?? 'tool', safeParse(tc.function?.arguments))
          upsertFeed({ kind: 'tool', id: tc.id, threadId: event.threadId ?? 'main', name: u.name, args: u.name !== (tc.toolInfo?.name ?? tc.function?.name) ? JSON.stringify(u.args) : (tc.function?.arguments ?? ''), status: 'running' })
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
          const { name, args } = unwrapCall(call?.toolInfo?.name ?? call?.function?.name ?? 'unknown', safeParse(call?.function?.arguments))
          found.push({ threadId: event.threadId ?? 'main', toolCallId: ref.id, toolName: name, args })
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

  // Deterministic replay of a recorded event stream (?replayEvents=/fixtures/real-run.jsonl):
  // the same reducer the live stream uses, fed from a file — judge mode for real-model runs.
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('replayEvents')
    if (!src) return
    let cancelled = false
    ;(async () => {
      try {
        const text = await (await fetch(src)).text()
        const lines = text.split('\n').filter(Boolean)
        upsertFeed({ kind: 'system', id: 'replay', text: `⟲ replaying ${lines.length} recorded harness events from ${src}` })
        setRunning(true)
        for (const line of lines) {
          if (cancelled) return
          const event = JSON.parse(line) as TurnEvent
          consume(event)
          // Judge mode holds at the gate exactly like the live harness does: the recorded
          // stream only continues once the operator countersigns or denies.
          if (event.type === 'tool.approval_required') {
            setRunning(false)
            await new Promise<void>((resolve) => { replayGateRef.current = resolve })
            if (cancelled) return
            setRunning(true)
          }
          // Pace on message boundaries only. Deltas are applied in a burst: yielding per
          // delta ties the replay to the frame rate, and the stage is expensive to draw.
          if (!isEventDelta(event as never)) await new Promise((r) => setTimeout(r, 40))
        }
      } finally { setRunning(false) }
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
    if (replayGateRef.current) {
      // Replay: nothing to send — release the recorded stream past the gate.
      const release = replayGateRef.current
      replayGateRef.current = null
      setReplayReleased(true)
      release()
      return
    }
    void stream(inputs)
  }, [pending, stream])

  return { feed, running, pending, send, respond, replayReleased, sessionId: sessionRef.current }
}

/**
 * Models may invoke MCP tools through TrueForge's `call_tool` meta-tool
 * ({ mcp_server, tool_name, input }) instead of the direct tool. The gate cares
 * about the effective tool, so unwrap it.
 */
function unwrapCall(name: string, args: Record<string, unknown>): { name: string; args: Record<string, unknown> } {
  if (name === 'call_tool' && typeof args.tool_name === 'string') {
    return { name: args.tool_name, args: (args.input as Record<string, unknown>) ?? {} }
  }
  return { name, args }
}

function safeParse(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try { return JSON.parse(s) } catch { /* fall through */ }
  // Recovery: if a merged stream ever yields the arguments JSON twice back-to-back
  // ({...}{...}), parse the first complete object.
  const start = s.indexOf('{')
  if (start < 0) return {}
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)) } catch { return {} } } }
  }
  return {}
}
