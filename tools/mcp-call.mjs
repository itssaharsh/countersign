// Call a tool on the running countersign MCP server (streamable HTTP client).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const [, , name, argsJson] = process.argv;
const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8977/mcp'));
const client = new Client({ name: 'countersign-tools', version: '0' });
await client.connect(transport);
const res = await client.callTool({ name, arguments: JSON.parse(argsJson ?? '{}') });
// Tool results carry undo_token, a capability that authorises a rollback against
// the live database. This prints to a terminal that may be on camera, so it is
// redacted here for the same reason the console redacts it on screen.
const out = res.content?.[0]?.text ?? JSON.stringify(res);
console.log(String(out).replace(/("(?:undo_)?token"\s*:\s*")[^"]+/g, '$1<redacted>'));
await client.close();
process.exit(0);
