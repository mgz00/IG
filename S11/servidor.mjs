// Servidor estático opcional: node servidor.mjs (sin dependencias).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = fileURLToPath(new URL('./', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webm': 'video/webm', '.md': 'text/plain; charset=utf-8' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requested = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const path = resolve(root, '.' + requested);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404).end('No encontrado'); }
}).listen(Number(process.env.PORT || 8111), '127.0.0.1', function () {
  console.log('CASA × CASA: http://127.0.0.1:' + this.address().port);
});
