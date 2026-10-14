// Servidor para probar el radar en tu compu: `npm run dev` y abrí http://localhost:5180
// Imita lo justo de Vercel: sirve public/ y ejecuta las funciones de api/.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PUERTO = Number(process.env.PORT) || 5180;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    let cuerpo = '';
    for await (const parte of req) cuerpo += parte;
    try { req.body = cuerpo ? JSON.parse(cuerpo) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (d) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d)); };
    try {
      const mod = await import(`./api/${url.pathname.slice(5).replace(/[^a-z-]/g, '')}.js?v=${Date.now()}`);
      await mod.default(req, res);
    } catch (e) {
      res.statusCode = e.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500;
      res.end(e.message);
    }
    return;
  }
  const ruta = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const archivo = await readFile(join('public', ruta.replace(/\.\./g, '')));
    res.setHeader('Content-Type', TIPOS[extname(ruta)] || 'application/octet-stream');
    res.end(archivo);
  } catch {
    res.statusCode = 404;
    res.end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`Radar en http://localhost:${PUERTO}`));
