// Where the console looks for the two services behind it.
//
// Three layers, most specific first: what the operator typed on the connect
// screen, then the build's environment, then the local defaults a checkout uses.
// The typed values live in this browser only. They are addresses, not secrets —
// no credential is stored here, and the engine still reads its database URLs from
// its own environment.
//
// Read at module scope because the harness client and the engine poller are both
// created once, before React renders. Changing an endpoint therefore reloads the
// page rather than trying to rebuild those clients underneath a running session.
const KEY = 'countersign-endpoints'

export type Endpoints = { forge: string; engine: string }

const DEFAULTS: Endpoints = {
  // '/' keeps the dev server's proxy, which is what a local checkout uses.
  forge: import.meta.env.VITE_TRUEFORGE_URL ?? '/',
  engine: import.meta.env.VITE_COUNTERSIGN_SERVER ?? 'http://127.0.0.1:8977',
}

function stored(): Partial<Endpoints> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Partial<Endpoints>) : {}
  } catch {
    // A browser with storage disabled still gets a working console on the defaults.
    return {}
  }
}

const trim = (u: string) => u.trim().replace(/\/+$/, '') || '/'

const current: Endpoints = { ...DEFAULTS, ...(() => {
  const s = stored()
  const out: Partial<Endpoints> = {}
  if (s.forge) out.forge = trim(s.forge)
  if (s.engine) out.engine = trim(s.engine)
  return out
})() }

export function endpoints(): Endpoints { return current }

/** True when this browser is pointed at something other than the build's defaults. */
export function isOverridden(): boolean {
  const s = stored()
  return Boolean(s.forge || s.engine)
}

/**
 * Persist and reload. The reload is the point: the harness client and the engine
 * poller are module-scope singletons, so a new address only takes effect on a
 * fresh page. Silently keeping the old connection while the form showed a new one
 * would be the worst of both.
 */
export function saveEndpoints(next: Partial<Endpoints>, go: string) {
  try {
    const merged = { ...stored() }
    if (next.forge !== undefined) merged.forge = trim(next.forge)
    if (next.engine !== undefined) merged.engine = trim(next.engine)
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // Storage refused: the navigation still happens, on the previous endpoints.
  }
  window.location.assign(go)
}

export function clearEndpoints() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
  window.location.assign('/')
}
