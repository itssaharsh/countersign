// Call a tool on the running countersign MCP server (streamable HTTP client).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const [, , name, argsJson] = process.argv;
const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8977/mcp'));
const client = new Client({ name: 'countersign-tools', version: '0' });
await client.connect(transport);
const res = await client.callTool({ name, arguments: JSON.parse(argsJson ?? '{}') });
console.log(res.content?.[0]?.text ?? JSON.stringify(res));
await client.close();
process.exit(0);
