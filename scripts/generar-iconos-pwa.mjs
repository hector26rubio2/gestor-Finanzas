import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const carpeta = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const salidas = [
  { origen: 'icon.svg', archivo: 'icon-192.png', tamano: 192 },
  { origen: 'icon.svg', archivo: 'icon-512.png', tamano: 512 },
  { origen: 'icon-maskable.svg', archivo: 'icon-maskable-192.png', tamano: 192 },
  { origen: 'icon-maskable.svg', archivo: 'icon-maskable-512.png', tamano: 512 },
  { origen: 'icon-maskable.svg', archivo: 'apple-touch-icon.png', tamano: 180 },
];

const ejecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const navegador = await chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });
try {
  for (const { origen, archivo, tamano } of salidas) {
    const svg = readFileSync(join(carpeta, origen), 'utf8');
    const pagina = await navegador.newPage({ viewport: { width: tamano, height: tamano } });
    await pagina.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${tamano}px;height:${tamano}px}</style>${svg}`,
    );
    await pagina.screenshot({ path: join(carpeta, archivo), omitBackground: true });
    await pagina.close();
    console.log(`${archivo} ${tamano}x${tamano}`);
  }
} finally {
  await navegador.close();
}
