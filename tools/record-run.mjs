// Record one real session as the three paired fixtures the console replays.
//
// They are ONE artifact: the console resolves the approval's simulation_id
// against /state, so the event stream and both snapshots have to come from a
// single seeding in a single session. Recording them separately either breaks
// the pairing or invites editing an id to make them line up, which would be
// fabricating evidence.
//
//   console/public/fixtures/real-run.jsonl        the harness event stream
//   console/public/fixtures/state-investigating.json  /state while the gate is open
//   console/public/fixtures/state-witnessing.json     /state after the commit
import { writeFileSync } from 'node:fs';
import { TrueForge, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk';

const FORGE = process.env.FORGE_URL ?? 'http://localhost:8790';
const ENGINE = process.env.ENGINE_URL ?? 'http://127.0.0.1:8977';
const OUT = new URL('../console/public/fixtures/', import.meta.url).pathname;
const ORDER = process.argv[2] ?? "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.";

const client = new TrueForge({ baseUrl: FORGE, timeoutInSeconds: 600 });
const state = async () => (await fetch(`${ENGINE}/state`)).json();

/** Events are mutated in place by mergeEventDelta — clone before keeping one. */
const keep = [];
const events = new Map();
function consume(e) {
  keep.push(structuredClone(e));
  if (isEventDelta(e)) { const base = events.get(e.id); if (base) mergeEventDelta(base, e); return; }
  events.set(e.id, e);
}

function unwrap(name, args) {
  return name === 'call_tool' && typeof args?.tool_name === 'string'
    ? { name: args.tool_name, args: args.input ?? {} } : { name, args };
}

const { data: session } = await client.sessions.create({ agent: { name: 'countersign' } });
console.log('session', session.id);

const turnIds = [];
let pendingApproval = null;

async function runTurn(input) {
  const s = await client.sessions.createTurnStream(session.id, { input });
  let turnId = null;
  for await (const { data: e } of s.withMetadata()) {
    if (e.type === 'turn.created') { turnId = e.turnId; turnIds.push(turnId); }
    consume(e);
    if (e.type === 'tool.approval_required') {
      for (const ref of e.toolCalls ?? []) {
        const msg = events.get(ref.sourceEventId);
        const call = msg?.toolCalls?.find((tc) => tc.id === ref.id);
        let parsed = {}; try { parsed = JSON.parse(call?.function?.arguments ?? '{}'); } catch { /* partial */ }
        const u = unwrap(call?.toolInfo?.name ?? call?.function?.name ?? '?', parsed);
        pendingApproval = { threadId: e.threadId ?? 'main', toolCallId: ref.id, ...u };
        console.log('GATE:', u.name, JSON.stringify(u.args).slice(0, 120));
      }
    }
  }
  return turnId;
}

const t0 = Date.now();
await runTurn([{ type: 'user.message', content: ORDER }]);
console.log(`turn 1 settled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!pendingApproval) { console.error('FAILED: no approval was raised; nothing recorded.'); process.exit(1); }

// Snapshot while the gate is open — this is the DECIDING screen's evidence.
const investigating = await state();
writeFileSync(`${OUT}state-investigating.json`, JSON.stringify(investigating, null, 1) + '\n');
console.log('state-investigating: sims', investigating.simulations.length);

await runTurn([{
  type: 'user.tool_approval', threadId: pendingApproval.threadId,
  toolCallId: pendingApproval.toolCallId, approval: { status: 'allow' },
}]);

const witnessing = await state();
writeFileSync(`${OUT}state-witnessing.json`, JSON.stringify(witnessing, null, 1) + '\n');
console.log('state-witnessing: sims', witnessing.simulations.length);

// Write the LIVE stream, not listTurnEvents. The stored view returns settled
// events only — the deltas are gone, and with them the streaming the console
// replays through its real reducer. `keep` holds every frame as it arrived,
// cloned at capture because mergeEventDelta mutates events in place.
// The stream spans both turns: the approval ends turn 1, countersigning starts turn 2.
writeFileSync(`${OUT}real-run.jsonl`, keep.map((e) => JSON.stringify(e)).join('\n') + '\n');
const deltas = keep.filter((e) => String(e.type).endsWith('.delta')).length;
console.log(`real-run.jsonl: ${keep.length} events across ${turnIds.length} turns (${deltas} deltas)`);
