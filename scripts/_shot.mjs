// Uso: node scripts/_shot.mjs <ruta> [ancho] [tema] [salida] — captura de viewport en modo demo.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const [route = 'dashboard', width = '1280', theme = '', out = `artifacts/shot-${route}.png`, action = ''] =
  process.argv.slice(2);
const base = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4300';
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: Number(width), height: 800 } });
const page = await context.newPage();
await page.route('**/config.js', (r) =>
  r.fulfill({ status: 200, contentType: 'application/javascript', body: "window.__FINANZAS_CONFIG__ = { mode: 'demo' };" }),
);
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Continuar como Valentina' }).click();
await page.waitForURL(/\/dashboard/);
if (theme) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
if (theme) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
if (action) {
  // acciones: "click:texto" separadas por ';'
  for (const step of action.split(';')) {
    const [kind, ...rest] = step.split(':');
    const arg = rest.join(':');
    if (kind === 'click') await page.getByText(arg, { exact: false }).first().click();
    if (kind === 'clickrole') await page.getByRole('button', { name: arg }).first().click();
    if (kind === 'wait') await page.waitForTimeout(Number(arg));
    if (kind === 'eval') await page.evaluate(arg);
  }
}
await mkdir(dirname(out), { recursive: true });
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORES:\n' + errors.join('\n'));
await browser.close();
