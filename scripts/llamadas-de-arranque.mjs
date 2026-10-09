import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { simularApi } from './api-simulada.mjs';

const baseUrl = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4300';
const rutas = (process.env.RUTAS ?? 'dashboard,movements,people,portfolio,notifications').split(',');

function browserExecutable() {
  const candidatos = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidatos.find((candidato) => {
    const resultado = spawnSync(candidato, ['--version'], { windowsHide: true, encoding: 'utf8' });
    return !resultado.error && resultado.status === 0;
  });
}

async function contar(browser, ruta) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const registro = [];
  context.on('request', (peticion) => {
    const url = new URL(peticion.url());
    if (url.pathname.startsWith('/api/v1/')) registro.push(`${peticion.method()} ${url.pathname}`);
  });
  await simularApi(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${ruta}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await context.close();
  const sinCanal = registro.filter((llamada) => !llamada.endsWith('/api/v1/events'));
  console.log(`${ruta}: ${sinCanal.length} llamadas`);
  for (const llamada of sinCanal) console.log(`  ${llamada}`);
  return sinCanal.length;
}

const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true, args: ['--no-sandbox'] });
try {
  for (const ruta of rutas) await contar(browser, ruta);
} finally {
  await browser.close();
}
