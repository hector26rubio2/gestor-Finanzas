/**
 * Un permiso por sección basta para entrar y ver algo.
 *
 * El modelo acordado: el permiso de la sección manda en el menú y en la entrada; los
 * permisos finos solo deciden qué se ve dentro. Lo que esta comprobación impide es la
 * regresión de siempre: que un permiso fino acabe cerrando la puerta, o que la pantalla
 * abra vacía —una pantalla vacía sin explicación se lee como averiada y se reporta como
 * un fallo que no existe—.
 *
 * Va con la sesión y los datos fingidos, sin API detrás: lo que se prueba es la decisión
 * del cliente, no el servidor.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const baseUrl = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4300';
const apiBaseUrl = 'http://api.invalido.local';

const secciones = [
  ['dashboard', 'dashboard.ver'],
  ['movements', 'movimientos.ver'],
  ['calendar', 'calendario.ver'],
  ['accounts', 'cuentas.ver'],
  ['people', 'personas.ver'],
  ['portfolio', 'patrimonio.ver'],
  ['planning', 'planificacion.ver'],
  ['reports', 'reportes.ver'],
  ['notifications', 'notificaciones.ver'],
  ['settings', 'preferencias.ver'],
  ['admin', 'administracion.ver'],
];

const banderas = secciones
  .filter(([ruta]) => ruta !== 'admin')
  .map(([ruta]) => ({ key: ruta, isEnabled: true, userId: null, updatedAt: '2026-01-01T00:00:00Z' }));

const vacios = {
  'movement-kinds': '[]',
  accounts: '[]',
  cards: '[]',
  categories: '[]',
  people: '[]',
  debts: '[]',
  investments: '[]',
  notifications: '[]',
  preferences: 'null',
  'movements/search': '{"items":[],"page":1,"size":25,"total":0,"totalPages":0,"hasNext":false}',
};

const sesion = (permiso) => ({
  user: {
    id: '20000000-0000-0000-0000-000000000001',
    displayName: 'Prueba',
    email: 'prueba@example.test',
    isActive: true,
  },
  organization: {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Espacio de prueba',
    slug: 'prueba',
    baseCurrency: 'COP',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  capabilities: [],
  organizations: [],
  expiresAt: '2027-01-01T00:00:00Z',
  permissions: ['sesion.ver', permiso],
});

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

async function revisar(browser, ruta, permiso) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    // El comodin va primero: en Playwright manda la ruta registrada mas tarde, asi que
    // los fingidos concretos de debajo ganan sobre este. Lo que nadie finja se queda en
    // una respuesta vacia y no sale a la red, en vez de esperar treinta segundos.
    await context.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('**/config.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: '${apiBaseUrl}' };`,
      }),
    );
    await context.route('**/api/v1/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sesion(permiso)) }),
    );
    await context.route('**/api/v1/feature-flags*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(banderas) }),
    );
    for (const [nombre, cuerpo] of Object.entries(vacios))
      await context.route(`**/api/v1/${nombre}*`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: cuerpo }),
      );
    // El canal en vivo se abre siempre; con otro tipo de contenido el navegador lo aborta
    // y escribe un error en consola que no dice nada de lo que aqui se comprueba.
    await context.route('**/api/v1/events*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': conectado\n\n' }),
    );

    const page = await context.newPage();
    const errores = [];
    page.on('pageerror', (error) => errores.push(error.message));
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });

    await page.goto(`${baseUrl}/${ruta}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const destino = new URL(page.url()).pathname;
    assert.equal(destino, `/${ruta}`, `${ruta}: con ${permiso} la entrada rebota a ${destino}`);

    const texto = (await page.locator('main#contenido-principal').innerText()).replace(/\s+/g, ' ').trim();
    assert.ok(texto.length > 40, `${ruta}: con ${permiso} la pantalla abre practicamente vacia ("${texto}")`);

    const enlaceDelMenu = await page.locator(`nav a[href="/${ruta}"]`).count();
    assert.equal(enlaceDelMenu, 1, `${ruta}: con ${permiso} la entrada no aparece en el menu`);

    const soloEsteEnlace = await page.locator('nav a').count();
    assert.equal(soloEsteEnlace, 1, `${ruta}: el menu ofrece ${soloEsteEnlace} entradas con un solo permiso concedido`);

    assert.equal(errores.length, 0, `${ruta}: errores en consola\n${errores.map((x) => `- ${x}`).join('\n')}`);
    console.log(`PASS ${ruta} con ${permiso}`);
  } finally {
    await context.close();
  }
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
    for (const [ruta, permiso] of secciones) {
      try {
        await revisar(browser, ruta, permiso);
      } catch (error) {
        fallos.push(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await browser.close();
  }
  assert.equal(fallos.length, 0, `\n${fallos.join('\n\n')}`);
  console.log(`Permisos por seccion: ${secciones.length} secciones, cada una con su unico permiso`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopServer);
