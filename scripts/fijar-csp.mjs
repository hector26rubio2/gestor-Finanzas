import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const salida = process.argv[2] ?? 'dist/browser';
const configuracion = process.argv[3] ?? 'public/config.js';
const origenesDeDesarrollo = 'http://localhost:* http://api.invalido.local';

function origenDeLaApi() {
  const coincidencia = readFileSync(configuracion, 'utf8').match(/apiBaseUrl:\s*'([^']+)'/);
  if (!coincidencia) throw new Error(`No se encontro apiBaseUrl en ${configuracion}`);
  return new URL(coincidencia[1]).origin;
}

const indice = join(salida, 'index.html');
const html = readFileSync(indice, 'utf8');
if (!html.includes(origenesDeDesarrollo))
  throw new Error('index.html no tiene los origenes de desarrollo de connect-src');

const origen = origenDeLaApi();
writeFileSync(indice, html.replace(origenesDeDesarrollo, origen));
console.log(`connect-src fijado a ${origen}`);
