import { createServer } from 'node:http';
import { create_lead_handler, read_lead_config } from './leads.mjs';
import { configure_transport } from './transports.mjs';
import { legal_content_approved } from './release-config.mjs';

const config = read_lead_config();
if (config.enabled && !legal_content_approved) throw new Error('legal_approval_required');
const transport = configure_transport();
if (config.enabled && transport.kind !== 'delivery') throw new Error('approved_delivery_transport_required');
const handler = create_lead_handler({ config, transport });
const server = createServer((req, res) => {
  void handler(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (!res.writableEnded) res.end('{"ok":false,"code":"internal_error"}');
  });
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 30;
const port = Number(process.env.LEADS_PORT || 4322);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_leads_port');
server.listen(port, '127.0.0.1', () => console.log(`Lead endpoint: http://127.0.0.1:${port}; enabled=${config.enabled}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
