import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const salida = process.argv[2] ?? 'dist/browser';
const navegacion = readFileSync('src/app/core/state/navigation.ts', 'utf8');
const rutasDeNavegacion = [...navegacion.matchAll(/path: '([\w-]+)'/g)].map(([, ruta]) => ruta);
const rutas = ['login', 'sin-acceso', ...rutasDeNavegacion];
const indice = join(salida, 'index.html');

if (rutasDeNavegacion.length === 0) throw new Error('No se encontraron rutas en navigation.ts');

for (const ruta of rutas) {
  mkdirSync(join(salida, ruta), { recursive: true });
  copyFileSync(indice, join(salida, ruta, 'index.html'));
}
copyFileSync(indice, join(salida, '404.html'));
console.log(`index.html copiado a ${rutas.length} rutas y 404.html`);
