import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

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
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  // A 720x450 CSS viewport exercises the layout available when a 1440x900
  // desktop viewport is viewed at 200% browser zoom.
  { width: 720, height: 450, label: 'zoom-200' },
];

let server;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function isReady() {
  try {
    const response = await fetch(`${baseUrl}/#/login`);
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
  server = spawn('pnpm.cmd', ['start'], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: true,
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
    server.kill('SIGTERM');
  }
}

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { windowsHide: true, encoding: 'utf8' });
    if (!result.error && result.status === 0) return candidate;
  }
  return undefined;
}

async function waitForRoute(page, route) {
  await page.evaluate((nextRoute) => {
    location.hash = `#/${nextRoute}`;
  }, route);
  await page.waitForURL(new RegExp(`#/${route}(?:$|[?])`));
  await page.locator('.workspace-page, .dashboard').first().waitFor({ state: 'visible' });
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

async function exerciseInteractions(page) {
  await waitForRoute(page, 'accounts');
  const cards = page.locator('.cards');
  const pageSize = page.getByLabel('Filas por página');
  for (const size of ['5', '10', '25']) {
    await pageSize.selectOption(size);
    const renderedRows = await page.locator('demo-table tbody tr').count();
    assert(renderedRows === Number(size), `The table did not render ${size} rows (rendered ${renderedRows})`);
  }
  await page.waitForFunction(() => document.querySelector('.cards')?.classList.contains('compact'));
  assert(await cards.evaluate((node) => node.classList.contains('compact')), 'Selecting 25 rows did not compact cards');

  const cardTrigger = page.locator('.bank-card').first();
  await cardTrigger.focus();
  await cardTrigger.press('Enter');
  const inspector = page.locator('dialog.inspector');
  await inspector.waitFor({ state: 'visible' });
  assert(
    await inspector.evaluate((node) => node.contains(document.activeElement)),
    'Focus did not move into inspector',
  );
  await page.getByLabel('Cerrar panel').click();
  await inspector.waitFor({ state: 'hidden' });
  assert(
    await cardTrigger.evaluate((node) => node === document.activeElement),
    'Inspector did not restore trigger focus',
  );

  const modalTrigger = page.getByRole('button', { name: 'Nuevo movimiento' });
  await modalTrigger.focus();
  await modalTrigger.press('Enter');
  const modal = page.locator('dialog:not(.inspector)');
  await modal.waitFor({ state: 'visible' });
  assert(await modal.evaluate((node) => node.contains(document.activeElement)), 'Focus did not move into modal');
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  assert(await modalTrigger.evaluate((node) => node === document.activeElement), 'Modal did not restore trigger focus');

  await waitForRoute(page, 'settings');
  await page.getByRole('button', { name: 'Esmeralda noche' }).click();
  assert((await page.locator('html').getAttribute('data-theme')) === 'dark', 'Dark theme was not applied');
}

async function testViewport(browser, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: 'light' });
  const page = await context.newPage();
  await page.route('**/config.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "window.__FINANZAS_CONFIG__ = { mode: 'demo' };",
    });
  });
  const consoleErrors = [];
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));

  try {
    await page.goto(`${baseUrl}/#/login`, { waitUntil: 'networkidle' });
    const viewportLabel = viewport.label ?? `${viewport.width}px`;
    const loginOverflow = await horizontalOverflow(page, `${viewportLabel} login`);
    if (loginOverflow) failures.push(loginOverflow);
    await page.getByRole('button', { name: 'Continuar como Valentina' }).click();
    await page.waitForURL(/#\/dashboard/);

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
  const browser = await chromium.launch({ executablePath, headless: true });
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
