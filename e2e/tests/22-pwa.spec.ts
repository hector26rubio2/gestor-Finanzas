import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { apiUrl } from '../support/entorno';

const puerto = Number(process.env.PWA_PUERTO ?? 4310);
const origen = `http://localhost:${puerto}`;
const raizWeb = join(__dirname, '..', '..');

let servidor: ChildProcess | undefined;

async function esperarServidor(): Promise<void> {
  const limite = Date.now() + 20_000;
  while (Date.now() < limite) {
    try {
      if ((await fetch(`${origen}/manifest.webmanifest`)).ok) return;
    } catch {
      await new Promise((resolver) => setTimeout(resolver, 250));
    }
  }
  throw new Error('El servidor estático de dist no respondió.');
}

async function esperarControl(page: Page): Promise<void> {
  await page.goto(origen + '/');
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r?.active)), null, {
    timeout: 60_000,
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.skip(!existsSync(join(raizWeb, 'dist', 'browser', 'ngsw.json')), 'Falta pnpm build (dist/browser/ngsw.json).');
  servidor = spawn(process.execPath, [join(raizWeb, 'scripts', 'servir-dist.mjs')], {
    env: { ...process.env, PWA_PUERTO: String(puerto), API_BASE_URL: apiUrl },
    stdio: 'ignore',
    windowsHide: true,
  });
  await esperarServidor();
});

test.afterAll(() => {
  servidor?.kill();
});

test.describe('PWA', () => {
  test('PWA-01 el manifest se sirve y es válido', async ({ page, request }) => {
    const respuesta = await request.get(`${origen}/manifest.webmanifest`);
    expect(respuesta.ok()).toBe(true);
    expect(respuesta.headers()['content-type']).toContain('manifest+json');
    const manifest = await respuesta.json();
    expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' });
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icono of manifest.icons) {
      const ico = await request.get(`${origen}/${icono.src}`);
      expect(ico.ok(), icono.src).toBe(true);
    }
    await page.goto(origen + '/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('PWA-02 el service worker se registra y controla la página tras recargar', async ({ page }) => {
    await esperarControl(page);
    const controla = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '');
    expect(controla).toContain('ngsw-worker.js');
  });

  test('PWA-03 sin red el shell carga y muestra Sin conexión', async ({ page, context }) => {
    await esperarControl(page);
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('app-root')).not.toBeEmpty();
    await expect(page.getByTestId('aviso-sin-conexion')).toContainText('Sin conexión');
    await context.setOffline(false);
    await expect(page.getByTestId('aviso-sin-conexion')).toHaveCount(0);
  });

  test('PWA-04 ninguna respuesta de /api/ ni config.js sale de la caché del service worker', async ({ page }) => {
    const llamadasApi: string[] = [];
    page.on('response', (respuesta) => {
      if (respuesta.url().startsWith(`${apiUrl}/api/`)) llamadasApi.push(respuesta.url());
    });
    await esperarControl(page);
    await page.waitForLoadState('networkidle');
    const urlsEnCache = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const nombre of await caches.keys()) {
        const cache = await caches.open(nombre);
        for (const peticion of await cache.keys()) urls.push(peticion.url);
      }
      return urls;
    });
    expect(urlsEnCache.length).toBeGreaterThan(0);
    expect(urlsEnCache.filter((url) => url.includes('/api/') || url.endsWith('/config.js'))).toEqual([]);
    expect(llamadasApi.length).toBeGreaterThan(0);
  });

  test('PWA-05 Chrome no reporta errores de instalabilidad', async ({ page }) => {
    await page.goto(origen + '/');
    const sesion = await page.context().newCDPSession(page);
    await sesion.send('Page.enable');
    const { installabilityErrors } = (await sesion.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors.filter((error) => error.errorId !== 'in-incognito')).toEqual([]);
  });
});
