import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const baseUrl = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4300';

const rutas = [
  'dashboard',
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'settings',
  'admin',
];

const escenarios = [
  { nombre: 'escritorio claro', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
  { nombre: 'escritorio oscuro', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
  { nombre: 'movil claro', viewport: { width: 390, height: 844 }, colorScheme: 'light' },
];

const impactosQueFallan = new Set(['serious', 'critical']);

let server;

async function isReady() {
  try {
    return (await fetch(`${baseUrl}/login`)).ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isReady()) return console.log(`Reusing server at ${baseUrl}`);
  console.log(`Starting Angular server at ${baseUrl}`);
  server = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['start'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: true,
    detached: process.platform !== 'win32',
  });
  let salida = '';
  server.stdout.on('data', (chunk) => (salida += chunk));
  server.stderr.on('data', (chunk) => (salida += chunk));
  const limite = Date.now() + 90_000;
  while (Date.now() < limite) {
    if (server.exitCode !== null) throw new Error(`El servidor murio al arrancar.\n${salida}`);
    if (await isReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`El servidor no estuvo listo en 90 segundos.\n${salida}`);
}

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  else
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
}

function browserExecutable() {
  const candidatos = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidato of candidatos) {
    const resultado = spawnSync(candidato, ['--version'], { windowsHide: true, encoding: 'utf8' });
    if (!resultado.error && resultado.status === 0) return candidato;
  }
  return undefined;
}

async function auditar(page, etiqueta) {
  await page.evaluate(axeSource);
  const resultado = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
  );
  return resultado.violations
    .filter((violacion) => impactosQueFallan.has(violacion.impact))
    .map((violacion) => {
      const ejemplo = violacion.nodes[0]?.target?.join(' ') ?? '';
      return `${etiqueta}: ${violacion.id} (${violacion.impact}, ${violacion.nodes.length}) en ${ejemplo}`;
    });
}

async function revisarEscenario(browser, escenario) {
  const context = await browser.newContext({ viewport: escenario.viewport, colorScheme: escenario.colorScheme });
  await context.route('**/config.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "window.__FINANZAS_CONFIG__ = { mode: 'demo' };",
    }),
  );
  const page = await context.newPage();
  const fallos = [];
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    const entrar = page.getByRole('button', { name: 'Continuar como Valentina' });
    await entrar.waitFor({ state: 'visible' });
    fallos.push(...(await auditar(page, `${escenario.nombre} /login`)));
    await entrar.click();
    await page.waitForURL(/\/dashboard/);

    for (const ruta of rutas) {
      await page.goto(`${baseUrl}/${ruta}`, { waitUntil: 'domcontentloaded' });
      await page
        .locator('.workspace-page, .dashboard, .admin-page, demo-sin-seccion, main#contenido-principal')
        .first()
        .waitFor({ state: 'visible' });
      await page.waitForTimeout(1200);
      fallos.push(...(await auditar(page, `${escenario.nombre} /${ruta}`)));
    }
  } finally {
    await context.close();
  }
  if (!fallos.length) console.log(`PASS ${escenario.nombre}: login y ${rutas.length} rutas`);
  return fallos;
}

async function main() {
  await ensureServer();
  const executablePath = browserExecutable();
  assert.ok(executablePath, 'No se encontro Chrome ni Edge. Apunte PLAYWRIGHT_CHROMIUM_EXECUTABLE al ejecutable.');
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const fallos = [];
  try {
    for (const escenario of escenarios) fallos.push(...(await revisarEscenario(browser, escenario)));
  } finally {
    await browser.close();
  }
  assert.equal(fallos.length, 0, `\nFallos graves de accesibilidad:\n${fallos.map((f) => `- ${f}`).join('\n')}`);
  console.log(
    `Accesibilidad: ${escenarios.length} escenarios, ${rutas.length + 1} pantallas cada uno, sin fallos graves`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopServer);
