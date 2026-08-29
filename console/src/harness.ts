// The console's connection to TrueForge — built directly on @truefoundry/trueforge-sdk,
// speaking the documented protocol: sessions, streamed turns, delta merging, and the
// pause/resume approval events. No wrapper; this IS the harness surface.
import { useCallback, useEffect, useRef, useState } from 'react'
import { TrueForge, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk'

const client = new TrueForge({ baseUrl: '/', timeoutInSeconds: 600 })
const RESUME_KEY = 'countersign-session'

// `createdAt` is the event's own timestamp, carried through untouched so the transcript
// can print it (DESIGN.md §3). It is optional because it is only ever copied, never
// invented: base events all carry one, deltas almost never do (3 of 206 in the recorded
// run), and an item assembled from deltas takes its parent event's stamp or none at all.
export type FeedItem =
  | { kind: 'user'; id: string; text: string; createdAt?: string }
  | { kind: 'assistant'; id: string; threadId: string; text: string; streaming: boolean; createdAt?: string; reasoningContent?: string }
  | { kind: 'tool'; id: string; threadId: string; name: string; args: string; status: 'running' | 'done' | 'error'; resultPreview?: string; createdAt?: string; resultAt?: string }
  | { kind: 'thread'; id: string; title: string; done: boolean; createdAt?: string }
  | { kind: 'system'; id: string; text: string }

export type PendingApproval = {
  threadId: string
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  kind: 'approval' | 'question'
}

type TurnEvent = Record<string, any>

export function useHarness() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [running, setRunning] = useState(false)
  const [pending, setPending] = useState<PendingApproval[]>([])
  const replayGateRef = useRef<(() => void) | null>(null)
  const rehydrateRef = useRef<((sessionId: string, turnId: string) => Promise<number>) | null>(null)
  const [replayReleased, setReplayReleased] = useState(false)
  const sessionRef = useRef<string | null>(null)
  const eventsRef = useRef<Map<string, TurnEvent>>(new Map())
  const turnRef = useRef<{ turnId: string | null; seq: number }>({ turnId: null, seq: 0 })
  // The reasoning each base model.message arrived carrying, kept because
  // mergeEventDelta mutates the stored event in place. See reasoningOf().
  const reasoningSeedRef = useRef<Map<string, string>>(new Map())

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
        // §3 — a line assembled from deltas is timestamped by its parent event, which is
        // this base event. mergeEventDelta leaves createdAt alone, so it is still the
        // base's own stamp; nothing here manufactures one.
        const at = typeof b.createdAt === 'string' ? b.createdAt : undefined
        const reasoning = reasoningOf(b.reasoningContent, reasoningSeedRef.current.get(b.id))
        // Reasoning is the only thing on screen during the first seconds of a turn, so a
        // message that is still nothing but reasoning has to reach the feed (§3).
        if (b.content || reasoning) upsertFeed({ kind: 'assistant', id: b.id, threadId: b.threadId ?? 'main', text: b.content ?? '', streaming: true, createdAt: at, reasoningContent: reasoning || undefined })
        // Tool calls accumulate through deltas too — surface them as they form.
        for (const tc of b.toolCalls ?? []) {
          if (tc?.id && (tc.toolInfo?.name || tc.function?.name)) {
            const u = unwrapCall(tc.toolInfo?.name ?? tc.function?.name, safeParse(tc.function?.arguments))
            upsertFeed({ kind: 'tool', id: tc.id, threadId: b.threadId ?? 'main', name: u.name, args: u.name !== (tc.toolInfo?.name ?? tc.function?.name) ? JSON.stringify(u.args) : (tc.function?.arguments ?? ''), status: 'running', createdAt: at })
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
        const seed = typeof event.reasoningContent === 'string' ? event.reasoningContent : ''
        reasoningSeedRef.current.set(event.id, seed)
        upsertFeed({ kind: 'assistant', id: event.id, threadId: event.threadId ?? 'main', text: event.content ?? '', streaming: false, createdAt: event.createdAt, reasoningContent: seed || undefined })
        for (const tc of event.toolCalls ?? []) {
          const u = unwrapCall(tc.toolInfo?.name ?? tc.function?.name ?? 'tool', safeParse(tc.function?.arguments))
          upsertFeed({ kind: 'tool', id: tc.id, threadId: event.threadId ?? 'main', name: u.name, args: u.name !== (tc.toolInfo?.name ?? tc.function?.name) ? JSON.stringify(u.args) : (tc.function?.arguments ?? ''), status: 'running', createdAt: event.createdAt })
        }
        break
      }
      case 'tool.response': {
        const id = event.toolCallId ?? event.id
        const preview = typeof event.content === 'string' ? event.content.slice(0, 400) : JSON.stringify(event.content)?.slice(0, 400)
        // resultAt closes the unit: the elapsed a finished call shows is the distance
        // between two recorded stamps (16.9s for run_investigation), not a wall clock.
        setFeed((f) => f.map((x) => (x.kind === 'tool' && x.id === id ? { ...x, status: 'done', resultPreview: preview, resultAt: event.createdAt } : x)))
        break
      }
      case 'turn.created': {
        // The turn carries its input. Identity is the turn, not the text: a live send()
        // places an optimistic item that is reconciled with its turn here; replays and
        // reconnects (no send()) get one item per turn, repeated orders included.
        for (const input of (event.input ?? []) as Array<{ type?: string; content?: unknown }>) {
          if (input?.type !== 'user.message' || typeof input.content !== 'string' || !input.content) continue
          const text = input.content
          const id = `u-${event.turnId ?? event.id}`
          setFeed((f) => {
            if (f.some((x) => x.kind === 'user' && x.id === id)) return f
            const i = f.findIndex((x) => x.kind === 'user' && x.id.startsWith('u-pending-') && x.text === text)
            if (i >= 0) return f.map((x, k) => (k === i ? { ...x, id, createdAt: event.createdAt } : x))
            return [...f, { kind: 'user', id, text, createdAt: event.createdAt }]
          })
        }
        break
      }
      case 'thread.created':
        upsertFeed({ kind: 'thread', id: event.threadId, title: event.title ?? 'subagent', done: false, createdAt: event.createdAt })
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
          found.push({ threadId: event.threadId ?? 'main', toolCallId: ref.id, toolName: name, args, kind: 'approval' })
        }
        setPending((p) => [...p, ...found])
        break
      }
      case 'tool.response_required': {
        // A question from the agent (ask_user_question): held like a gate, answered with
        // user.tool_response. Rebuilt on reload the same way approvals are.
        const found: PendingApproval[] = []
        for (const ref of event.toolCalls ?? []) {
          const msg = events.get(ref.sourceEventId)
          const call = msg?.toolCalls?.find((tc: TurnEvent) => tc.id === ref.id)
          const { name, args } = unwrapCall(call?.toolInfo?.name ?? call?.function?.name ?? 'question', safeParse(call?.function?.arguments))
          found.push({ threadId: event.threadId ?? 'main', toolCallId: ref.id, toolName: name, args, kind: 'question' })
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
      const msg = String((err as Error).message ?? err)
      if (/approvals or questions are pending/i.test(msg) && sessionRef.current && turnRef.current.turnId) {
        upsertFeed({ kind: 'system', id: `err-${Date.now()}`, text: 'the harness is waiting on a gate this page did not show; reopening it' })
        try {
          await rehydrateRef.current?.(sessionRef.current, turnRef.current.turnId)
        } catch (e2) {
          upsertFeed({ kind: 'system', id: `err2-${Date.now()}`, text: `could not reopen the gate: ${String((e2 as Error).message ?? e2)} · original error: ${msg}` })
        }
      } else {
        upsertFeed({ kind: 'system', id: `err-${Date.now()}`, text: `stream error: ${msg}` })
      }
    } finally {
      setRunning(false)
    }
  }, [consume, upsertFeed])

  const persistResume = useCallback(() => {
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ sessionId: sessionRef.current, turnId: turnRef.current.turnId, seq: turnRef.current.seq }))
    } catch { /* storage unavailable */ }
  }, [])

  // Rebuild the transcript and any open gate from a turn's stored events. Used after a
  // reload (the server still holds the approval even though the page forgot it) and
  // after the harness refuses an order because a gate is open.
  const rehydrate = useCallback(async (sessionId: string, turnId: string) => {
    const page = await client.sessions.listTurnEvents(sessionId, turnId, { order: 'asc' } as never)
    const events: TurnEvent[] = []
    for await (const e of page as unknown as AsyncIterable<TurnEvent>) events.push(e)
    events.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    setPending([])
    for (const e of events) consume(e)
    return events.length
  }, [consume])
  rehydrateRef.current = rehydrate

  // Survive reconnects: if a turn was running when the page died, re-attach to its
  // live stream (subscribeToTurn resumes after the last seen sequence number). If it
  // ended paused on a gate, rebuild the gate so it can still be answered.
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
        const required = (turn.state as { requiredActions?: unknown[] } | undefined)?.requiredActions ?? []
        if (turn.state?.status !== 'running' && required.length) {
          const n = await rehydrate(saved.sessionId, saved.turnId)
          if (!cancelled) upsertFeed({ kind: 'system', id: 'resume', text: `⟲ reopened turn ${saved.turnId.slice(0, 8)}… with a gate still open (${n} events restored)` })
          return
        }
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
          if (event.type === 'tool.approval_required' || event.type === 'tool.response_required') {
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
    if (pending.length) {
      upsertFeed({ kind: 'system', id: `gate-${Date.now()}`, text: 'a gate is open: countersign, deny, or answer the question first. To send this text back to the agent instead, put it in the deny reason and press Deny.' })
      return
    }
    upsertFeed({ kind: 'user', id: `u-pending-${Date.now()}`, text })
    void stream([{ type: 'user.message', content: text }])
  }, [pending, stream, upsertFeed])

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

  /** Answer a pending question (tool.response_required) with user.tool_response. */
  const answer = useCallback((toolCallId: string, content: string) => {
    const q = pending.find((p) => p.toolCallId === toolCallId && p.kind === 'question')
    if (!q) return
    setPending((prev) => prev.filter((p) => p !== q))
    if (replayGateRef.current) { const release = replayGateRef.current; replayGateRef.current = null; setReplayReleased(true); release(); return }
    void stream([{ type: 'user.tool_response', threadId: q.threadId, toolCallId: q.toolCallId, content }])
  }, [pending, stream])

  /** Forget the saved session and start clean: the escape hatch for a stuck tab. */
  const startOver = useCallback(() => {
    try { localStorage.removeItem(RESUME_KEY) } catch { /* storage unavailable */ }
    // Keep the query string: in judge mode that is the replay itself (restart the
    // fixture stream), never a switch into live mode.
    window.location.href = window.location.pathname + window.location.search
  }, [])

  return { feed, running, pending, send, respond, answer, startOver, replayReleased, sessionId: sessionRef.current }
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

/**
 * The reasoning to print for a merged model.message.
 *
 * TrueForge emits the base `model.message` with its reasoning already complete and then
 * replays the same text token by token as `model.message.delta` — verified against
 * `real-run.jsonl`, where all 45 reasoning deltas re-derive text the base event already
 * carried. `mergeEventDelta` concatenates, so the merged field reads the reasoning twice.
 * The base event's own value (`seed`) is the authority for as long as the delta stream is
 * only catching up to it; once the stream says something the seed does not contain, the
 * merged value is the truth and is printed whole.
 *
 * This drops a duplicate. It never adds a word the harness did not send.
 */
function reasoningOf(merged: unknown, seed: string | undefined): string {
  const m = typeof merged === 'string' ? merged : ''
  if (!seed) return m
  const streamed = m.startsWith(seed) ? m.slice(seed.length) : m
  return seed.startsWith(streamed) ? seed : m
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
