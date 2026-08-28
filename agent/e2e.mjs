// End-to-end proof: the countersign agent simulates, verifies, evaluates policy,
// then TrueForge pauses on the gated commit_change (tool.approval_required); we
// resume with user.tool_approval and read the receipt. Also records every event
// to fixtures/ for the console's replay mode.
import { writeFileSync, mkdirSync } from 'node:fs';
import { TrueForge, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk';

const BASE = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const ORDER = process.argv.slice(2).find((a) => !a.startsWith('--'))
  ?? "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.";
const AUTO_APPROVE = process.argv.includes('--approve');

const client = new TrueForge({ baseUrl: BASE, timeoutInSeconds: 600 });
const recorded = [];
const events = new Map();
const pendingApprovals = [];

const { data: session } = await client.sessions.create({ agent: { name: 'countersign' } });
console.log('session:', session.id);

async function runTurn(input) {
  const stream = await client.sessions.createTurnStream(session.id, { input });
  for await (const { data: event } of stream.withMetadata()) {
    recorded.push(event);
    if (isEventDelta(event)) {
      const base = events.get(event.id);
      if (base) mergeEventDelta(base, event);
      continue;
    }
    events.set(event.id, event);
    if (event.type === 'model.message' && event.threadId === 'main' && event.content) {
      console.log('AGENT:', String(event.content).slice(0, 160).replace(/\n/g, ' '));
    }
    if (event.type === 'tool.approval_required') {
      pendingApprovals.push(event);
      console.log('*** PAUSE — tool.approval_required ***');
    }
    if (event.type === 'turn.done') {
      console.log('turn.done:', event.state?.status, '| requiredActions:', JSON.stringify(event.state?.requiredActions ?? null)?.slice(0, 200));
    }
  }
}

await runTurn([{ type: 'user.message', content: ORDER }]);

for (const pending of pendingApprovals) {
  for (const ref of pending.toolCalls ?? []) {
    const msg = events.get(ref.sourceEventId);
    const call = msg?.toolCalls?.find((tc) => tc.id === ref.id);
    console.log(`GATED CALL: ${call?.toolInfo?.name} args=${String(call?.function?.arguments).slice(0, 140)}`);
  }
}

if (AUTO_APPROVE && pendingApprovals.length) {
  console.log('--- approving and resuming ---');
  const inputs = pendingApprovals.flatMap((p) =>
    (p.toolCalls ?? []).map((ref) => ({
      type: 'user.tool_approval', threadId: p.threadId, toolCallId: ref.id, approval: { status: 'allow' },
    })));
  pendingApprovals.length = 0;
  await runTurn(inputs);
}

mkdirSync('fixtures', { recursive: true });
writeFileSync('fixtures/e2e-events.jsonl', recorded.map((e) => JSON.stringify(e)).join('\n'));
console.log(`recorded ${recorded.length} events -> fixtures/e2e-events.jsonl`);
// Exit code mirrors the outcome so CI and scripts can trust it (Qodo PR3#7).
const lastDone = [...recorded].reverse().find((e) => e.type === 'turn.done');
process.exit(lastDone?.state?.status === 'error' ? 1 : 0);
