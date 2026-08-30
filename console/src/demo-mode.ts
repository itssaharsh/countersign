// Arm the public demo's replay BEFORE anything else reads the URL.
//
// This has to be its own module, imported first. `useFreshness` decides whether
// it is in replay mode at module scope, and ES imports all evaluate before the
// importing module's own statements run — so injecting these parameters inside
// main.tsx's body is too late, and the freshness clock treats a year-old recorded
// measurement as live. The gate then opens already stale.
//
// A deployed build has no engine and no harness behind it; both are long-lived
// local processes holding database credentials and neither belongs on a static
// host. So the demo replays a recorded run rather than pretending to have one:
// the same event stream through the same reducer, holding at the real approval.
if (import.meta.env.VITE_DEMO_REPLAY === '1' && typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search)
  // Anyone who arrives with their own replay parameters keeps them.
  if (!q.has('replay') && !q.has('replayEvents')) {
    q.set('replayEvents', '/fixtures/real-run.jsonl')
    q.set('replay', '/fixtures/state-investigating.json')
    q.set('replayAfter', '/fixtures/state-witnessing.json')
    window.history.replaceState({}, '', `${window.location.pathname}?${q}`)
  }
}
