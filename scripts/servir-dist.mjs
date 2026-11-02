import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'browser');
const puerto = Number(process.env.PWA_PUERTO ?? 4310);
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:5198';

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const sinCache = new Set([
  '/index.html',
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/config.js',
  '/manifest.webmanifest',
]);

const servidor = createServer((peticion, respuesta) => {
  const ruta = decodeURIComponent(new URL(peticion.url ?? '/', 'http://localhost').pathname);
  if (ruta === '/config.js') {
    respuesta.writeHead(200, { 'content-type': tipos['.js'], 'cache-control': 'no-store' });
    respuesta.end(`window.__FINANZAS_CONFIG__ = { apiBaseUrl: ${JSON.stringify(apiBaseUrl)} };`);
    return;
  }
  const candidato = normalize(join(raiz, ruta));
  const existe = candidato.startsWith(raiz) && existsSync(candidato) && statSync(candidato).isFile();
  const archivo = existe ? candidato : join(raiz, 'index.html');
  const url = existe ? ruta : '/index.html';
  respuesta.writeHead(200, {
    'content-type': tipos[extname(archivo)] ?? 'application/octet-stream',
    'cache-control': sinCache.has(url) ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(archivo).pipe(respuesta);
});

servidor.listen(puerto, '127.0.0.1', () => console.log(`dist servido en http://localhost:${puerto}`));
