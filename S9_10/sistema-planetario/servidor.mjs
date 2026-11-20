// Servidor para la versión ya compilada: no necesita npm ci ni paquetes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
    '.jpg':'image/jpeg','.png':'image/png','.tif':'image/tiff'};
createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
        const content = await readFile(path);
        res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream'});
        res.end(content);
    } catch { res.writeHead(404).end('No encontrado'); }
}).listen(8100, '127.0.0.1', () => console.log('Sistema planetario: http://127.0.0.1:8100'));
