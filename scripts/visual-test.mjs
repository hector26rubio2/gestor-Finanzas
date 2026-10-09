import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { simularApi } from './api-simulada.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(webRoot, 'artifacts');
const baseUrl = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4300';
const routes = [
  'dashboard',
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'admin',
  'settings',
];
const viewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 412, height: 915, label: 's26-ultra' },
  { width: 768, height: 1024 },
  { width: 820, height: 1180, label: 'ipad-air' },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 3440, height: 1440, label: 'ultrawide' },
  { width: 720, height: 450, label: 'zoom-200' },
];

let server;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function isReady() {
  try {
    const response = await fetch(`${baseUrl}/login`);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isReady()) {
    console.log(`Reusing server at ${baseUrl}`);
    return;
  }
  console.log(`Starting Angular server at ${baseUrl}`);
  server = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['start'], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: true,
    detached: process.platform !== 'win32',
  });
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk));
  server.stderr.on('data', (chunk) => (output += chunk));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Angular server exited early.\n${output}`);
    if (await isReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Angular server did not become ready within 90 seconds.\n${output}`);
}

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  } else {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
}

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { windowsHide: true, encoding: 'utf8' });
    if (!result.error && result.status === 0) return candidate;
  }
  return undefined;
}

async function waitForRoute(page, route) {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(new RegExp(`/${route}(?:$|[?])`));
  try {
    await page.locator('[data-page], fin-sin-seccion').first().waitFor({ state: 'visible' });
  } catch {
    const donde = page.url();
    const texto = (
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    )
      .slice(0, 240)
      .replace(/\s+/g, ' ');
    throw new Error(`La ruta ${route} no llego a pintarse. URL: ${donde}. En pantalla: ${texto}`);
  }
}

async function chooseOption(page, ariaLabel, optionLabel) {
  await page.locator(`[data-slot="select-trigger"][aria-label^="${ariaLabel}"]`).click();
  const item = page.locator('[data-slot="select-item"]', { hasText: new RegExp(`^\\s*${optionLabel}\\s*$`) }).first();
  await item.click();
  await item.waitFor({ state: 'detached' });
}

async function horizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  return metrics.scrollWidth <= metrics.clientWidth + 1
    ? null
    : `${label}: document has horizontal overflow (${metrics.scrollWidth}px > ${metrics.clientWidth}px)`;
}

async function devuelveElFoco(locator, mensaje) {
  try {
    await locator.evaluate(
      (node) =>
        new Promise((listo, falla) => {
          if (node === document.activeElement) return listo(true);
          const tope = Date.now() + 2000;
          const mirar = () => {
            if (node === document.activeElement) return listo(true);
            if (Date.now() > tope) return falla(new Error('sin foco'));
            requestAnimationFrame(mirar);
          };
          mirar();
        }),
    );
  } catch {
    const donde = await locator
      .evaluate(() => {
        const activo = document.activeElement;
        if (!activo) return 'ninguno';
        const etiqueta = activo.getAttribute('aria-label') ?? (activo.textContent ?? '').trim().slice(0, 30);
        return `${activo.tagName.toLowerCase()}${activo.className ? '.' + String(activo.className).split(' ')[0] : ''} "${etiqueta}"`;
      })
      .catch(() => 'no medible');
    assert(false, `${mensaje} (el foco quedo en ${donde})`);
  }
}

async function exerciseInteractions(page) {
  await waitForRoute(page, 'accounts');
  for (const size of ['5', '10', '25']) {
    await chooseOption(page, 'Filas por página', size);
    const renderedRows = await page.locator('fin-table tbody tr').count();
    assert(renderedRows === Number(size), `The table did not render ${size} rows (rendered ${renderedRows})`);
  }

  await page.locator('hlm-toggle-group button[aria-pressed]').nth(1).click();
  const cardTrigger = page.getByRole('button', { name: 'Ver extracto y detalle' });
  await cardTrigger.focus();
  await cardTrigger.press('Enter');
  const inspector = page.locator('[data-slot="sheet-content"]');
  await inspector.waitFor({ state: 'visible' });
  assert(
    await inspector.evaluate((node) => node.contains(document.activeElement)),
    'Focus did not move into inspector',
  );
  await page.getByLabel('Cerrar panel').click();
  await inspector.waitFor({ state: 'detached' });
  await devuelveElFoco(cardTrigger, 'Inspector did not restore trigger focus');

  const modalTrigger = page.getByRole('button', { name: 'Nuevo movimiento' });
  await modalTrigger.focus();
  await modalTrigger.press('Enter');
  const modal = page.locator('[data-slot="dialog-content"]');
  await modal.waitFor({ state: 'visible' });
  assert(await modal.evaluate((node) => node.contains(document.activeElement)), 'Focus did not move into modal');
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached' });
  await devuelveElFoco(modalTrigger, 'Modal did not restore trigger focus');

  await waitForRoute(page, 'settings');
  await page.getByRole('button', { name: 'Noche índigo' }).click();
  assert((await page.locator('html').getAttribute('data-theme')) === 'dark', 'Dark theme was not applied');
}

async function testViewport(browser, viewport) {
  const context = await browser.newContext({ locale: 'es-CO', viewport, colorScheme: 'light' });
  const page = await context.newPage();
  await simularApi(context);
  const consoleErrors = [];
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));

  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    const viewportLabel = viewport.label ?? `${viewport.width}px`;
    await page.waitForURL(/\/dashboard/);

    if (viewport.width === 1440) await exerciseInteractions(page);

    for (const route of routes) {
      await waitForRoute(page, route);
      const overflow = await horizontalOverflow(page, `${viewportLabel} ${route}`);
      if (overflow) failures.push(overflow);
      await page.screenshot({
        path: join(artifacts, viewport.label ?? String(viewport.width), `${route}.png`),
        fullPage: true,
      });
    }

    if (consoleErrors.length)
      failures.push(
        `${viewportLabel} emitted console errors:\n${consoleErrors.map((error) => `- ${error}`).join('\n')}`,
      );
    assert(failures.length === 0, failures.join('\n'));
    console.log(`PASS ${viewportLabel} (${viewport.width}x${viewport.height}): ${routes.length} routes`);
  } finally {
    await context.close();
  }
}

async function main() {
  await rm(artifacts, { recursive: true, force: true });
  for (const viewport of viewports)
    await mkdir(join(artifacts, viewport.label ?? String(viewport.width)), { recursive: true });
  await ensureServer();
  const executablePath = browserExecutable();
  assert(
    executablePath,
    'No se encontro Chrome ni Edge. Instale uno, o apunte PLAYWRIGHT_CHROMIUM_EXECUTABLE al ejecutable.',
  );
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const failures = [];
    for (const viewport of viewports) {
      try {
        await testViewport(browser, viewport);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    assert(failures.length === 0, failures.join('\n\n'));
    console.log(`UI smoke test passed: ${routes.length * viewports.length} route screenshots in ${artifacts}`);
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopServer);
