// mocksmith — a deterministic OpenAI-compatible /chat/completions endpoint for
// ZERO-CREDIT testing of the full Countersign loop. It is not an LLM: it is a
// scripted operator that always follows the doctrine (investigate → commit →
// receipt), driving the REAL MCP tools through the REAL TrueForge harness —
// pauses, approvals, and all. Demo day swaps the agent back to a real model.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_MODEL_PORT ?? 8990);

function toolName(tools, suffix) {
  const t = (tools ?? []).find((t) => t.function?.name?.endsWith(suffix));
  return t?.function?.name ?? null;
}

function collectCallNames(messages) {
  const byId = new Map();
  for (const m of messages) {
    if (m.role === 'assistant') for (const tc of m.tool_calls ?? []) byId.set(tc.id, tc.function?.name ?? '');
  }
  return byId;
}

function lastToolResult(messages, callNamesById) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') return null; // a newer user turn outranks old tool results
    if (m.role === 'tool') {
      const name = callNamesById.get(m.tool_call_id) ?? '';
      const text = typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.map((c) => c.text ?? '').join('') : '';
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* tolerate prose */ }
      return { name, text, parsed };
    }
  }
  return null;
}

function findInHistory(messages, regex) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const text = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.map((c) => c.text ?? '').join('') : '';
    const hit = text?.match?.(regex);
    if (hit) return hit;
  }
  return null;
}

function findSim(messages) {
  return findInHistory(messages, /"simulation_id"\s*:\s*"([0-9a-f]{8})"/)?.[1] ?? null;
}
function summarize(d) {
  const t = (d.blast_radius ?? []).filter((x) => (x.delta ?? 0) > 0).slice(0, 3);
  return t.map((x) => `${x.name} −${x.delta}`).join(', ') || 'no rows lost';
}

/** Decide the next scripted step from the conversation. */
function decide(messages, tools) {
  const callNames = collectCallNames(messages);
  const last = lastToolResult(messages, callNames);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content
    : Array.isArray(lastUser?.content) ? lastUser.content.map((c) => c.text ?? '').join('') : '';

  if (last) {
    const n = last.name;
    if (n.endsWith('run_investigation')) {
      const d = last.parsed ?? {};
      if (d.ready_to_commit && d.undo?.undo_token) {
        return { tool: toolName(tools, 'commit_change'), args: { simulation_id: d.simulation_id, undo_token: d.undo.undo_token },
          preface: `Investigation complete. Blast radius measured: ${summarize(d)}. Undo verified on committed shadow state. Policy: ${d.policy?.verdict}. Requesting commit — this will pause for your approval.` };
      }
      return { text: `Investigation blocked — not requesting a commit. ${d.undo?.verified === false ? 'NOT RESTORED BY THE GENERATED ROLLBACK.' : ''} Policy: ${d.policy?.verdict ?? 'unknown'}. ${d.next_step ?? ''}` };
    }
    if (n.endsWith('commit_change')) {
      const d = last.parsed ?? {};
      if (d.committed) return { tool: toolName(tools, 'measure_actual'), args: { simulation_id: findSim(messages) }, preface: `Commit executed: ${d.deleted_root_rows} root rows removed, scoped to ${d.scoped_to} approved keys. Measuring actual state for the receipt.` };
      if (d.refused) return { text: `Commit REFUSED by the server: ${d.message ?? d.code}. ${d.code === 'fingerprint_drift' ? 'The target set drifted since measurement — approval is void. Re-measure before retrying.' : ''}` };
      return { text: `Commit was not executed (${last.text.slice(0, 120)}).` };
    }
    if (n.endsWith('measure_actual')) {
      return { text: `RECEIPT — measured after execution: ${last.text.slice(0, 400)}\nThe verified undo remains armed. We only delete what we can prove we can restore.` };
    }
    if (n.endsWith('fire_undo')) {
      const d = last.parsed ?? {};
      return { text: d.undone ? 'Undo fired and verified — the approved primary-key set is restored on the live database.' : `Undo did not execute: ${last.text.slice(0, 160)}` };
    }
    return { text: `Tool ${n} returned. ${last.text.slice(0, 200)}` };
  }

  // Fresh user order.
  const sql = userText.match(/(DELETE\s+FROM[\s\S]+?|ALTER\s+TABLE[\s\S]+?)(?:\.\s|$|;)/i)?.[1]?.trim();
  if (/fire|undo|rollback|restore/i.test(userText) && findSim(messages)) {
    const tok = findInHistory(messages, /"undo_token"\s*:\s*"([0-9a-f-]{36})"/);
    return { tool: toolName(tools, 'fire_undo'), args: { simulation_id: findSim(messages), undo_token: tok?.[1] }, preface: 'Firing the verified undo — this pauses for your approval.' };
  }
  if (sql) {
    return { tool: toolName(tools, 'run_investigation'), args: { change_sql: sql.replace(/;$/, '') },
      preface: 'Order received. Running the governed investigation pipeline: shadow simulation, undo verification against committed state, deterministic policy.' };
  }
  return { text: 'mocksmith (scripted test model): give me a SQL change to process, e.g. "Process this change request: DELETE FROM users WHERE last_active < \'2025-01-01\'".' };
}

let reqCount = 0;
const server = createServer(async (req, res) => {
  if (!req.url?.includes('/chat/completions')) {
    if (req.url?.includes('/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ object: 'list', data: [{ id: 'scripted-1', object: 'model' }] })); return; }
    res.writeHead(404).end(); return;
  }
  let body = '';
  for await (const c of req) body += c;
  const { messages = [], tools, stream } = JSON.parse(body || '{}');
  const step = decide(messages, tools);
  if (!step.tool && messages.length > 2) console.log('   DEBUG roles:', JSON.stringify(messages.map((m) => ({ role: m.role, tc: (m.tool_calls ?? []).length, keys: Object.keys(m), content: typeof m.content === 'string' ? m.content.slice(0, 80) : m.content }))).slice(0, 1200));
  const id = `chatcmpl-mock${++reqCount}`;
  console.log(`#${reqCount} msgs=${messages.length} tools=${(tools ?? []).length} -> ${step.tool ?? 'text'}`);
  if ((tools ?? []).length && reqCount <= 3) console.log('   tools:', (tools ?? []).map((t) => t.function?.name).join(', '));

  const toolCalls = step.tool ? [{ index: 0, id: `call_mock_${reqCount}`, type: 'function', function: { name: step.tool, arguments: JSON.stringify(step.args ?? {}) } }] : undefined;
  const content = step.preface ?? step.text ?? '';

  if (stream === false) {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'scripted-1',
      choices: [{ index: 0, message: { role: 'assistant', content, ...(toolCalls ? { tool_calls: toolCalls.map(({ index, ...t }) => t) } : {}) }, finish_reason: toolCalls ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (delta, finish = null) => res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'scripted-1', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
  send({ role: 'assistant' });
  for (const word of content.split(/(?<= )/)) { send({ content: word }); await new Promise((r) => setTimeout(r, 8)); }
  if (toolCalls) {
    send({ tool_calls: [{ index: 0, id: toolCalls[0].id, type: 'function', function: { name: toolCalls[0].function.name, arguments: '' } }] });
    const args = toolCalls[0].function.arguments;
    for (let i = 0; i < args.length; i += 40) { send({ tool_calls: [{ index: 0, function: { arguments: args.slice(i, i + 40) } }] }); }
    send({}, 'tool_calls');
  } else {
    send({}, 'stop');
  }
  res.write('data: [DONE]\n\n');
  res.end();
});

server.listen(PORT, '127.0.0.1', () => console.log(`mocksmith (scripted test model) on http://127.0.0.1:${PORT}/v1`));
