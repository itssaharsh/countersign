// First-time-user review of the operator console, at the two viewports it is
// designed for: 1920x1080 and 390x844.
//
// Retargeted from the deleted v5 scroll story. That tool keyed off
// section[data-shot] and the 3D stage canvas; neither exists any more — the
// artifact is the console (DESIGN.md §0), so the screens are the console's
// phases and the checks are DESIGN.md §8's quality floor.
//
// waitUntil is 'domcontentloaded', never 'networkidle'. The dev server proxies
// /api/* to the harness; when that service is down the proxied request hangs
// until its timeout, networkidle never fires, and the review never runs.
//
// Defect classes:
//   horizontalOverflow   the page scrolls sideways
//   clipped              text cut off by its own box
//   overlaps             two text blocks sitting on each other
//   occlusion            the fixed gate bar covering content at the page bottom
//   tinyText             below 10.5px
//   unnamed              a control with no accessible name
//   smallTargets         under 40x32 on a narrow viewport
//   contrast             a text node under 4.5:1 against its actual ground (§8)
//   keyboard             the full path, with a visible focus ring at every stop
//
// The contrast check is computed, not asserted from a table: it reads the
// composited background out of the ancestor chain and the colour off the text
// node's own parent, and derives relative luminance per WCAG 2.x. --graphite on
// --bone (4.91:1) passes; --rule as text (1.31:1) does not, and did not.
//
// Usage: node tools/design-review.mjs <outdir> [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'review';
const base = (process.argv[3] ?? 'http://localhost:5199').replace(/\/$/, '');
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  ['desktop-1920x1080', { width: 1920, height: 1080 }],
  ['mobile-390x844', { width: 390, height: 844 }],
];

// The screens a stranger can reach with no engine running. Replay fixtures are
// the recorded real-model run (simulation cdac3df6), so nothing here is drawn
// from invented data.
const SCREENS = [
  ['idle', '/'],
  ['deciding', '/?replayEvents=/fixtures/real-run.jsonl&replay=/fixtures/state-investigating.json'],
  ['witnessing', '/?replay=/fixtures/state-witnessing.json'],
];

const SETTLE = Number(process.env.WAIT ?? 4000);

/* ── the in-page audit ──────────────────────────────────────────────────── */
const AUDIT = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return `${el.tagName.toLowerCase()}${cls} "${(el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ')}"`;
  };

  const problems = {
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    clipped: [], overlaps: [], occlusion: [], tinyText: [], unnamed: [],
    smallTargets: [], contrast: [], contrastSkipped: [],
  };

  /* clipped text: the box actually cuts its content off. Overflow that is
     merely visible is not clipping — that surfaces as horizontalOverflow. */
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,button,label,a,li,div')) {
    if (!vis(el)) continue;
    if (el.hasAttribute('data-allow-clip')) continue;
    // Only leaves: a wrapper's scrollWidth is its children's business.
    if ([...el.children].some((c) => c.nodeType === 1 && (c.textContent || '').trim())) continue;
    const cs = getComputedStyle(el);
    const cut = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis';
    if (!cut) continue;
    if (el.scrollWidth > el.clientWidth + 3) problems.clipped.push(label(el));
  }

  /* overlapping text blocks. Fixed elements are excluded from pairing: the gate
     bar is deliberately over the page (§3), and its occlusion is checked
     separately, at the scroll position where it could actually bite. */
  const fixed = (el) => {
    for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
    return false;
  };
  const SEL = 'h1,h2,h3,p,.receipt-line,.receipt-chip,.brand,.rig,.phase-track,.submit,.col-transcript';
  const blocks = [...document.querySelectorAll(SEL)].filter((el) => vis(el) && !fixed(el))
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 12 && oy > 12 && ox * oy > 900) {
      problems.overlaps.push([label(a.el), label(b.el), `${Math.round(ox)}x${Math.round(oy)}`]);
    }
  }

  /* tiny text */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textEls = [];
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (!el || !(t.textContent || '').trim() || !vis(el)) continue;
    if (!seen.has(el)) { seen.add(el); textEls.push(el); }
  }
  for (const el of textEls) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 10.5) problems.tinyText.push(`${label(el)} ${fs}px`);
  }

  /* controls: named, and big enough to hit on a phone */
  for (const el of document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')) {
    if (!vis(el)) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim();
    if (!name) problems.unnamed.push(label(el));
    const r = el.getBoundingClientRect();
    if (innerWidth < 500 && (r.width < 40 || r.height < 32)) {
      problems.smallTargets.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  /* ── §8 contrast: every text node ≥ 4.5:1 against its real ground ──────
     Computed from the styles the browser resolved, not from a table of known
     pairs: read the colour, composite the ancestor backgrounds behind it,
     convert both to relative luminance, and divide. */
  const rgba = (s) => {
    const str = String(s);
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    // color-mix() — which is how §5's WITNESSING ground is struck from --proof
    // and --bone — serialises as color(srgb r g b [/ a]) with 0..1 channels.
    const c = str.match(/color\(srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.eE+-]+))?\s*\)/);
    if (c) {
      const [r, g, b] = c.slice(1, 4).map((v) => Number(v) * 255);
      const a = c[4] == null ? 1 : Number(c[4]);
      return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a };
    }
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  for (const el of textEls) {
    // Blended text cannot be judged from computed styles — the pixel is a
    // function of what is painted underneath. Recorded, never silently dropped.
    let blended = null, imaged = null, faded = null;
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') blended = blended ?? `${label(n)} mix-blend-mode:${cs.mixBlendMode}`;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') imaged = imaged ?? `${label(n)} background-image`;
      if (parseFloat(cs.opacity) < 1) faded = faded ?? `${label(n)} opacity:${cs.opacity}`;
      const bg = rgba(cs.backgroundColor);
      if (bg && bg.a > 0) stack.push(bg);
      if (bg && bg.a >= 1) break;
    }
    if (blended || imaged || faded) {
      problems.contrastSkipped.push(`${label(el)} — ${blended || imaged || faded}`);
      continue;
    }
    // Composite bottom-up. The canvas under everything is the html background,
    // and white if even that is transparent.
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
    const fg0 = rgba(getComputedStyle(el).color);
    if (!fg0) { problems.contrastSkipped.push(`${label(el)} — unparsable color`); continue; }
    const fg = over(fg0, bg);
    const r = ratio(fg, bg);
    if (r < 4.5) {
      problems.contrast.push(`${label(el)} ${r.toFixed(2)}:1 (${getComputedStyle(el).color} on rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)}))`);
    }
  }

  return problems;
};

/* The gate bar is fixed. At the bottom of the page it must not be sitting on
   content — §3 makes it persistent, not an overlay that eats the last line. */
const OCCLUSION = () => {
  const bar = document.querySelector('.gate-bar');
  if (!bar) return [];
  const b = bar.getBoundingClientRect();
  const hits = [];
  for (const el of document.querySelectorAll('.col-dossier p, .col-dossier .receipt-line, .col-dossier button, .col-transcript p')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
    if (oy > 2 && r.left < b.right && r.right > b.left) {
      hits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]} "${(el.textContent || '').trim().slice(0, 30)}" by ${Math.round(oy)}px (el ${Math.round(r.top)}-${Math.round(r.bottom)}, bar ${Math.round(b.top)}-${Math.round(b.bottom)}, scrollY ${Math.round(scrollY)}/${document.documentElement.scrollHeight - innerHeight}, pad ${getComputedStyle(document.querySelector('.console')).paddingBottom})`);
    }
  }
  return hits;
};

/* ── focus rings: §8 says 2px --ink, offset 2px, never outline:none ─────── */
const RING = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return { ok: false, why: 'nothing focused' };
  const cs = getComputedStyle(el);
  const width = parseFloat(cs.outlineWidth) || 0;
  const offset = parseFloat(cs.outlineOffset) || 0;
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  const to = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  const expected = ink.startsWith('#') ? to(ink) : ink;
  const ok = cs.outlineStyle !== 'none' && width >= 2 && offset >= 2 && cs.outlineColor === expected;
  return {
    ok,
    el: `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}`,
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} offset ${cs.outlineOffset}`,
    expected,
  };
};

/** Tab until `sel` has focus, so the ring is a real :focus-visible ring. */
async function tabTo(page, sel, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), sel)) return true;
  }
  return false;
}

/* ── a scripted TrueForge, so the whole keyboard path can be driven ──────
   §8 requires the path input → submit → countersign hold → deny → undo →
   restore hold. Half of it only exists once the harness raises a gate, and the
   RESTORE gate only exists after a commit, so the review serves the harness's
   own HTTP surface (POST /api/v1/sessions, POST …/turns as SSE) and the /state
   the console polls. Every figure comes from the recorded fixtures; the script
   only decides when each one is on screen. */
function harness() {
  const s = { phase: 'empty', turns: 0, posts: [], approvalsResolved: [] };
  const ev = (n, o) => `id: ${n}\ndata: ${JSON.stringify(o)}\n\n`;
  const now = () => new Date().toISOString();

  s.sse = (input) => {
    s.turns += 1;
    const turnId = `turn-${s.turns}`;
    const msgId = `msg-${s.turns}`;
    const callId = `call-${s.turns}`;
    let n = 0;
    let body = ev(++n, {
      type: 'turn.created', id: `tc-${s.turns}`, turn_id: turnId, thread_id: null,
      previous_turn_id: null, created_at: now(), state: { status: 'running' }, input,
    });

    const approval = (tool) => {
      body += ev(++n, {
        type: 'model.message', id: msgId, thread_id: 'main', created_at: now(), content: '',
        tool_calls: [{
          id: callId, type: 'function',
          tool_info: { type: 'mcp', name: 'call_tool', server_id: 'countersign', server_name: 'countersign' },
          function: { name: 'call_tool', arguments: JSON.stringify({ mcp_server: 'countersign', tool_name: tool, input: { simulation_id: 'cdac3df6' } }) },
        }],
      });
      body += ev(++n, {
        type: 'tool.approval_required', id: `ar-${s.turns}`, thread_id: 'main',
        created_at: now(), tool_calls: [{ id: callId, source_event_id: msgId }],
      });
    };
    const say = (text) => {
      body += ev(++n, { type: 'model.message', id: msgId, thread_id: 'main', created_at: now(), content: text });
    };

    const first = input?.[0] ?? {};
    if (first.type === 'user.message') {
      // An order. The first one is the change; every later one is the undo.
      if (s.phase === 'empty') { approval('commit_change'); s.phase = 'measured'; }
      else approval('fire_undo');
    } else if (first.type === 'user.tool_approval') {
      const status = first.approval?.status;
      s.approvalsResolved.push(status);
      if (status === 'allow' && s.phase === 'measured') { s.phase = 'committed'; say('Committed. The receipt is on screen.'); }
      else if (status === 'allow') say('Restored. The rows are back.');
      else say('Denied. Nothing was done.');
    } else {
      say('ok');
    }

    body += ev(++n, {
      type: 'turn.done', id: `td-${s.turns}`, thread_id: null, created_at: now(),
      state: { status: 'done', completed_at: now(), output: null, required_actions: [] },
    });
    return body;
  };
  return s;
}

/** Match on pathname only — the console carries fixture paths in its query
 *  string, and a glob would intercept the document navigation itself. */
const at = (re) => (url) => re.test(new URL(url).pathname);

async function installHarness(page, mock, fixtures) {
  await page.route(at(/^\/api\/v1\/agents$/), (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ name: 'countersign', manifest: { model: { name: 'scripted-review' } } }] }) }));
  await page.route(at(/^\/api\/v1\/sessions$/), (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id: 'sess-review', agent: { id: 'agent-countersign', type: 'agent', name: 'countersign' }, created_by: 'design-review', title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }) }));
  await page.route(at(/^\/api\/v1\/sessions\/[^/]+\/turns$/), async (r) => {
    const input = JSON.parse(r.request().postData() || '{}').input ?? [];
    mock.posts.push(input?.[0]?.type ?? 'unknown');
    await r.fulfill({ status: 200, contentType: 'text/event-stream', body: mock.sse(input) });
  });
  await page.route(at(/^\/fixtures\/review-state\.json$/), (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(fixtures[mock.phase]) }));
}

/* ── run ────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch();
const report = {};

// The states the scripted harness serves, straight from the recorded fixtures.
const investigating = await (await fetch(`${base}/fixtures/state-investigating.json`)).json();
const witnessing = await (await fetch(`${base}/fixtures/state-witnessing.json`)).json();
const FIXTURES = { empty: { simulations: [], backends: {} }, measured: investigating, committed: witnessing };

for (const [vname, viewport] of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  const errors = [];
  const offline = [];
  const audits = {};

  for (const [sname, path] of SCREENS) {
    const page = await context.newPage();
    // A console with no engine behind it is a supported state (§8: it must render
    // a sane empty state with no agent connected), and the browser logs the
    // refused fetch as an error. Those are reported, never counted as defects; a
    // real script error never looks like this.
    const offlineNoise = /CORS policy|net::ERR_|Failed to load resource|Failed to fetch/;
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = `${sname}: ${m.text().slice(0, 160)}`;
      (offlineNoise.test(m.text()) ? offline : errors).push(t);
    });
    page.on('pageerror', (e) => errors.push(`${sname}: pageerror ${String(e).slice(0, 160)}`));
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(SETTLE);
    await page.screenshot({ path: `${out}/${vname}-${sname}.png` });
    const a = await page.evaluate(AUDIT);
    // Measure the gate bar against the content only once the scroll has actually
    // landed at the bottom — measuring mid-scroll reports overlaps that are not
    // there when the page is at rest.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(
      () => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1,
      null, { timeout: 5000 },
    ).catch(() => {});
    await page.waitForTimeout(250);
    a.occlusion = await page.evaluate(OCCLUSION);
    audits[sname] = a;
    await page.close();
  }

  /* the full keyboard path, against the scripted harness */
  const kpage = await context.newPage();
  kpage.on('pageerror', (e) => errors.push(`keyboard: pageerror ${String(e).slice(0, 160)}`));
  const mock = harness();
  await installHarness(kpage, mock, FIXTURES);
  const stops = [];
  const step = async (name, sel, note) => {
    const found = await tabTo(kpage, sel);
    const ring = found ? await kpage.evaluate(RING) : { ok: false, why: `never reached ${sel}` };
    stops.push({ stop: name, reached: found, ring });
    return found && ring.ok ? (note ?? true) : false;
  };

  await kpage.goto(`${base}/?replay=/fixtures/review-state.json`, { waitUntil: 'domcontentloaded' });
  await kpage.waitForSelector('#change-sql', { timeout: 15000 });

  // 1 — input
  await step('input', '#change-sql');
  await kpage.keyboard.type("DELETE FROM users WHERE last_active < '2025-01-01'");
  // 2 — submit
  await step('submit', '.submit-go');
  await kpage.keyboard.press('Enter');
  await kpage.waitForSelector('.hold', { timeout: 20000 });

  // 3 — deny is present on every open gate, and reachable
  await step('deny (commit gate)', '.gate-secondary');
  // 4 — countersign hold: Enter, held for the full 1200ms
  await step('countersign hold', '.hold');
  const verb = await kpage.textContent('.hold .hold-text');
  await kpage.keyboard.down('Enter');
  await kpage.waitForTimeout(1500);
  await kpage.keyboard.up('Enter');
  await kpage.waitForSelector('.receipt', { timeout: 20000 });
  await kpage.waitForFunction(() => document.querySelector('.receipt')?.dataset.printing === 'false', null, { timeout: 20000 });

  // 5 — the undo control: it sends an order, it does not act
  await step('undo (send the order)', '.undo-go');
  await kpage.keyboard.press('Enter');
  await kpage.waitForSelector('.hold.is-undo', { timeout: 20000 });

  // 6 — deny the restore gate, for real
  await step('deny (restore gate)', '.gate-secondary');
  await kpage.keyboard.press('Enter');
  await kpage.waitForSelector('.undo-go', { timeout: 20000 });

  // 7 — send it again, and countersign the restore
  await step('undo again', '.undo-go');
  await kpage.keyboard.press('Enter');
  await kpage.waitForSelector('.hold.is-undo', { timeout: 20000 });
  await step('restore hold', '.hold');
  const restoreVerb = await kpage.textContent('.hold .hold-text');
  await kpage.keyboard.down('Enter');
  await kpage.waitForTimeout(1500);
  await kpage.keyboard.up('Enter');
  await kpage.waitForTimeout(600);
  const finished = await kpage.textContent('.hold .hold-text').catch(() => null);
  await kpage.screenshot({ path: `${out}/${vname}-keyboard-end.png` });

  const keyboard = {
    stops,
    verbs: { commit: (verb || '').trim(), restore: (restoreVerb || '').trim(), after: (finished || '').trim() || 'control withdrew' },
    resolved: mock.approvalsResolved,
    posts: mock.posts,
    ringFailures: stops.filter((s) => !s.reached || !s.ring.ok),
    ok: stops.length === 8
      && stops.every((s) => s.reached && s.ring.ok)
      && (verb || '').trim() === 'HOLD TO COUNTERSIGN'
      && (restoreVerb || '').trim() === 'HOLD TO RESTORE'
      && mock.approvalsResolved.join(',') === 'allow,deny,allow',
  };
  await kpage.close();
  await context.close();

  report[vname] = { errors, offline, audits, keyboard };
}

writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));

let failures = 0;
for (const [vname, r] of Object.entries(report)) {
  console.log(`== ${vname}: page errors=${r.errors.length}${r.offline.length ? ` (+${r.offline.length} engine-offline fetch failures, expected with no engine on this origin — not counted)` : ''}`);
  const totals = { hOverflow: 0, clipped: 0, overlaps: 0, occlusion: 0, tinyText: 0, unnamed: 0, smallTargets: 0, contrast: 0, contrastSkipped: 0 };
  for (const [sname, a] of Object.entries(r.audits)) {
    totals.hOverflow += a.horizontalOverflow ? 1 : 0;
    for (const k of ['clipped', 'overlaps', 'occlusion', 'tinyText', 'unnamed', 'smallTargets', 'contrast', 'contrastSkipped']) totals[k] += a[k].length;
    const bad = ['clipped', 'overlaps', 'occlusion', 'tinyText', 'unnamed', 'smallTargets', 'contrast'].reduce((n, k) => n + a[k].length, 0) + (a.horizontalOverflow ? 1 : 0);
    console.log(`   ${sname}: ${bad === 0 ? 'clean' : `${bad} defect(s)`}`);
  }
  console.log('   totals', JSON.stringify(totals));
  const lines = Object.entries(r.audits).flatMap(([s, a]) => [
    ...a.overlaps.map((o) => `overlap ${o.join(' | ')}`),
    ...a.clipped.map((c) => `clipped ${c}`),
    ...a.occlusion.map((c) => `occluded ${c}`),
    ...a.unnamed.map((u) => `unnamed ${u}`),
    ...a.smallTargets.map((t) => `small ${t}`),
    ...a.tinyText.map((t) => `tiny ${t}`),
    ...a.contrast.map((t) => `contrast ${t}`),
  ].map((l) => `[${s}] ${l}`));
  for (const l of [...new Set(lines)].slice(0, 20)) console.log('   ' + l);
  const skipped = [...new Set(Object.values(r.audits).flatMap((a) => a.contrastSkipped))];
  if (skipped.length) console.log(`   contrast not computable (blended/faded), reported not ignored: ${skipped.slice(0, 4).join(' ; ')}`);
  console.log(`   keyboard path: ${r.keyboard.ok ? 'PASS' : 'FAIL'} — ${r.keyboard.stops.length} stops, rings ${r.keyboard.stops.filter((s) => s.ring.ok).length}/${r.keyboard.stops.length}, verbs ${r.keyboard.verbs.commit} → ${r.keyboard.verbs.restore} → ${r.keyboard.verbs.after}, approvals ${r.keyboard.resolved.join(',')}`);
  if (!r.keyboard.ok) console.log('   keyboard failures:', JSON.stringify(r.keyboard.ringFailures));
  failures += totals.hOverflow + totals.clipped + totals.overlaps + totals.occlusion + totals.tinyText + totals.unnamed + totals.smallTargets + totals.contrast + r.errors.length + (r.keyboard.ok ? 0 : 1);
}
console.log(`\nreport → ${out}/report.json · ${failures === 0 ? 'CLEAN' : `${failures} finding(s)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
