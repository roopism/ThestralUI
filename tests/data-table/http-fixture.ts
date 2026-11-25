import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { initialTickets, readPage } from '../../catalog/data-table/work-records';

/** A real, ephemeral HTTP data owner. It never returns the full collection to the table. */
export async function startTicketServer() {
  let records = [...initialTickets];
  let rejectSave = true;
  const requests: { method: string; path: string; ids?: string[] }[] = [];
  let finishSlow: (() => void) | undefined;
  const slow = new Promise<void>(resolve => { finishSlow = resolve; });
  const completed: string[] = [];
  async function serve(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const url = new URL(req.url!, 'http://127.0.0.1');
    const method = req.method!;
    if (method === 'GET' && url.pathname === '/fixture.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><title>HTTP queue</title></html>');
      return;
    }
    const log: (typeof requests)[number] = { method, path: url.pathname + url.search };
    requests.push(log);
    function send(status: number, payload: unknown) {
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
      completed.push(log.path);
    }
    if (method === 'GET') {
      const query = url.searchParams.get('q') ?? '', sort = url.searchParams.get('sort');
      if (query === 'slow') {
        await slow;
        send(200, { rows: [{ id: 'slow', title: 'Slow result', team: 'South', category: 'slow' }], totalRows: 1 });
        return;
      }
      send(200, readPage(records, { query, page: Number(url.searchParams.get('page')), sort: sort ? { column: sort, ascending: url.searchParams.get('asc') === 'true' } : null }));
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const value = JSON.parse(body) as { title?: string; ids?: string[] };
    if (method === 'PATCH' && url.pathname.startsWith('/records/')) {
      if (rejectSave) { rejectSave = false; send(409, { error: 'Changed by another reviewer' }); return; }
      const row = records.find(item => item.id === decodeURIComponent(url.pathname.slice(9)));
      if (!row || !value.title) { send(422, { error: 'Invalid record' }); return; }
      const saved = { ...row, title: value.title };
      records = records.map(item => item.id === row.id ? saved : item);
      send(200, saved); return;
    }
    if (method === 'POST' && url.pathname === '/archive' && value.ids) {
      log.ids = value.ids;
      const count = records.length;
      records = records.filter(row => !value.ids!.includes(row.id));
      send(200, count - records.length); return;
    }
    send(404, {});
  }
  const server = createServer((req, res) => { void serve(req, res).catch(() => res.writeHead(500).end()); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw Error('Missing HTTP test port');
  return { port: addr.port, requests, completed, finishSlow: () => finishSlow!(), records: () => records,
    async close() { finishSlow!(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } };
}
