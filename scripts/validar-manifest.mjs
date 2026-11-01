import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publico = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const errores = [];

function exigir(condicion, mensaje) {
  if (!condicion) errores.push(mensaje);
}

function dimensionesPng(ruta) {
  const datos = readFileSync(ruta);
  const firma = datos.subarray(0, 8).toString('hex');
  if (firma !== '89504e470d0a1a0a') return null;
  return `${datos.readUInt32BE(16)}x${datos.readUInt32BE(20)}`;
}

const manifest = JSON.parse(readFileSync(join(publico, 'manifest.webmanifest'), 'utf8'));

for (const campo of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color'])
  exigir(Boolean(manifest[campo]), `falta ${campo}`);
exigir(manifest.display === 'standalone', 'display debe ser standalone');
exigir(
  Array.isArray(manifest.display_override) && manifest.display_override.includes('window-controls-overlay'),
  'display_override incompleto',
);
exigir(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4, 'faltan shortcuts');

const iconos = manifest.icons ?? [];
for (const icono of iconos) {
  const ruta = join(publico, icono.src);
  exigir(existsSync(ruta), `no existe ${icono.src}`);
  if (icono.type === 'image/png' && existsSync(ruta))
    exigir(
      dimensionesPng(ruta) === icono.sizes,
      `${icono.src}: tamaño real ${dimensionesPng(ruta)} distinto de ${icono.sizes}`,
    );
}
for (const tamano of ['192x192', '512x512'])
  for (const proposito of ['any', 'maskable'])
    exigir(
      iconos.some((i) => i.sizes === tamano && i.purpose === proposito),
      `falta icono ${tamano} ${proposito}`,
    );
exigir(
  iconos.some((i) => i.sizes === 'any' && i.type === 'image/svg+xml'),
  'falta icono SVG sizes any',
);

const apple = join(publico, 'icons', 'apple-touch-icon.png');
exigir(existsSync(apple) && dimensionesPng(apple) === '180x180', 'apple-touch-icon debe ser 180x180');

for (const atajo of manifest.shortcuts ?? []) {
  exigir(atajo.name && atajo.url?.startsWith('/'), `atajo inválido ${JSON.stringify(atajo)}`);
  for (const icono of atajo.icons ?? []) exigir(existsSync(join(publico, icono.src)), `atajo sin ${icono.src}`);
}

if (errores.length) {
  console.error(errores.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log(`manifest válido: ${iconos.length} íconos, ${manifest.shortcuts.length} atajos`);
