// Prueba de humo del servidor MCP: lo arranca, lista herramientas y llama a check_offer.
// Uso: npx tsx scripts/mcp-smoke.mts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'scripts/mcp.ts'] }));
const { tools } = await client.listTools();
console.log('herramientas:', tools.map((t) => t.name).join(', '));
const res = await client.callTool({
  name: 'check_offer',
  arguments: {
    supplierId: 'envases-sur', unitPriceCents: 23_500, deliveryDays: 5, quantity: 500,
    maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000, maxDeliveryDays: 5, blockedSupplierIds: [],
  },
});
console.log('check_offer:', JSON.parse((res.content as { text: string }[])[0].text).decision);
await client.close();
