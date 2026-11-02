import { apiUrl } from '../support/entorno';
import { expect, test, type Locator, type Page } from '../support/fixtures';
import { elegir } from '../support/ui';
import { nombres } from '../support/semilla';

const RETARDO_MS = 2500;
const FONDO_CLARO = 'rgb(247, 248, 251)';
const FONDO_OSCURO = 'rgb(15, 18, 34)';
const NEGRO = ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)'];

const pausa = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

async function retrasar(page: Page, patron: RegExp, ms = RETARDO_MS): Promise<void> {
  await page.route(patron, async (ruta) => {
    await pausa(ms);
    await ruta.continue().catch(() => undefined);
  });
}

async function leerApi(page: Page, ruta: string): Promise<any> {
  const respuesta = await page.request.get(`${apiUrl}${ruta}`);
  expect(respuesta.status(), `GET ${ruta}`).toBe(200);
  return respuesta.json();
}

const listaDe = (cuerpo: any): any[] => (Array.isArray(cuerpo) ? cuerpo : (cuerpo?.items ?? []));

const paginaVacia = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };

async function irSinEsperar(page: Page, ruta: string): Promise<void> {
  await page.goto(`/${ruta}`, { waitUntil: 'commit' });
}

const fondoDe = (page: Page, selector: string) =>
  page.locator(selector).evaluate((nodo) => getComputedStyle(nodo).backgroundColor);

test.describe('Pantalla de arranque', () => {
  const retrasarPaquete = (page: Page) => retrasar(page, /\/(main|polyfills)[^/]*\.js(\?|$)/, 1500);

  test.describe('tema claro', () => {
    test.use({ colorScheme: 'light', storageState: { cookies: [], origins: [] } });

    test('CAR-01 se ve desde el primer pintado con el fondo claro y luego desaparece', async ({ page, vigilancia }) => {
      vigilancia.permitirSinSesion();
      await retrasarPaquete(page);
      await irSinEsperar(page, 'login');
      const arranque = page.locator('#arranque');
      await expect(arranque).toBeVisible();
      expect(await fondoDe(page, '#arranque')).toBe(FONDO_CLARO);
      expect(NEGRO).not.toContain(await fondoDe(page, 'body'));
      await expect(arranque).toHaveCount(0, { timeout: 20_000 });
      await expect(page.locator('app-root')).not.toBeEmpty();
    });
  });

  test.describe('tema oscuro del sistema', () => {
    test.use({ colorScheme: 'dark', storageState: { cookies: [], origins: [] } });

    test('CAR-02 respeta el modo oscuro del sistema sin destello blanco', async ({ page, vigilancia }) => {
      vigilancia.permitirSinSesion();
      await retrasarPaquete(page);
      await irSinEsperar(page, 'login');
      await expect(page.locator('#arranque')).toBeVisible();
      expect(await fondoDe(page, '#arranque')).toBe(FONDO_OSCURO);
      expect(await fondoDe(page, 'html')).toBe(FONDO_OSCURO);
      await expect(page.locator('#arranque')).toHaveCount(0, { timeout: 20_000 });
    });
  });

  test.describe('tema guardado', () => {
    test.use({ colorScheme: 'light', storageState: { cookies: [], origins: [] } });

    test('CAR-03 usa el tema oscuro guardado aunque el sistema sea claro', async ({ page, vigilancia }) => {
      vigilancia.permitirSinSesion();
      await page.addInitScript(() =>
        localStorage.setItem('finanzas.arranque', JSON.stringify({ theme: 'dark', locale: 'en' })),
      );
      await retrasarPaquete(page);
      await irSinEsperar(page, 'login');
      await expect(page.locator('#arranque')).toBeVisible();
      expect(await fondoDe(page, '#arranque')).toBe(FONDO_OSCURO);
      await expect(page.locator('#arranque')).toContainText('Loading your information');
      await expect(page.locator('#arranque')).toHaveCount(0, { timeout: 20_000 });
    });
  });

  test('CAR-04 desaparece también cuando el arranque de la API falla', async ({ page, vigilancia }) => {
    await page.route(/\/api\/v1\/bootstrap/, (ruta) =>
      ruta.fulfill({ status: 500, contentType: 'application/json', body: '{"title":"error"}' }),
    );
    await irSinEsperar(page, 'dashboard');
    await expect(page.locator('#arranque')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('app-root')).not.toBeEmpty();
    vigilancia.aceptarErroresEsperados();
  });
});

test.describe('Carga de página', () => {
  test('CAR-05 la barra aparece con el componente de la ruta retrasado y se va al terminar', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-page]').first()).toBeVisible();
    await retrasar(page, /\/(chunk|portfolio)[^/]*\.js(\?|$)/, 1800);
    await page.getByRole('link', { name: 'Patrimonio' }).first().click();
    const barra = page.locator('[data-testid=barra-de-navegacion]');
    await expect(barra).toBeVisible();
    await expect(page.locator('[data-testid=indicador-de-carga]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
    await expect(barra).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('[data-testid=indicador-de-carga]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/portfolio/);
  });

  test('CAR-06 una navegación rápida no muestra la barra', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-page]').first()).toBeVisible();
    await page.getByRole('link', { name: 'Notificaciones' }).first().click();
    await expect(page).toHaveURL(/\/notifications/);
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.evaluate(() => {
      const marcas: number[] = [];
      new MutationObserver(() => {
        if (document.querySelector('[data-testid=barra-de-navegacion]')) marcas.push(Date.now());
      }).observe(document.body, { childList: true, subtree: true });
      (window as any).__marcasDeBarra = marcas;
    });
    await page.getByRole('link', { name: 'Notificaciones' }).first().click();
    await expect(page).toHaveURL(/\/notifications/);
    await page.waitForTimeout(400);
    const marcas = await page.evaluate(() => (window as any).__marcasDeBarra as number[]);
    expect(marcas).toEqual([]);
  });
});

interface Pantalla {
  nombre: string;
  ruta: string;
  retrasa: RegExp;
  zona: (page: Page) => Locator;
  vacia?: { cuerpo: unknown; texto?: RegExp };
  datos: (page: Page, zona: Locator) => Promise<void>;
  conDatosPrevios?: boolean;
  retardoMs?: number;
}

const esqueletoEn = (zona: Locator) => zona.locator('fin-skeleton');
const vacioDeTabla = /No hay registros/;

async function tablaConNombres(page: Page, zona: Locator, ruta: string, campo: string): Promise<void> {
  const items = listaDe(await leerApi(page, ruta));
  expect(items.length, `datos reales en ${ruta}`).toBeGreaterThan(0);
  await expect(zona.getByText(String(items[0][campo]), { exact: false }).first()).toBeVisible();
}

const pantallas: Pantalla[] = [
  {
    nombre: 'Administración · Usuarios',
    ruta: 'admin?tab=users',
    retrasa: /\/api\/v1\/superadmin\/users(\?|$)/,
    zona: (page) => page.locator('app-admin-users-tab fin-zona-de-carga'),
    vacia: { cuerpo: paginaVacia, texto: vacioDeTabla },
    datos: (page, zona) => tablaConNombres(page, zona, '/api/v1/superadmin/users', 'displayName'),
  },
  {
    nombre: 'Administración · Roles',
    ruta: 'admin?tab=roles',
    retrasa: /\/api\/v1\/superadmin\/roles(\?|$)/,
    zona: (page) => page.locator('app-admin-roles-tab fin-zona-de-carga'),
    vacia: { cuerpo: paginaVacia, texto: vacioDeTabla },
    datos: (page, zona) => tablaConNombres(page, zona, '/api/v1/superadmin/roles', 'name'),
  },
  {
    nombre: 'Administración · Organizaciones',
    ruta: 'admin?tab=organizations',
    retrasa: /\/api\/v1\/superadmin\/organizations(\?|$)/,
    zona: (page) => page.locator('app-admin-organizations-tab fin-zona-de-carga'),
    vacia: { cuerpo: paginaVacia, texto: vacioDeTabla },
    datos: (page, zona) => tablaConNombres(page, zona, '/api/v1/superadmin/organizations', 'name'),
  },
  {
    nombre: 'Administración · Errores',
    ruta: 'admin?tab=errors',
    retrasa: /\/api\/v1\/superadmin\/errors(\?|$)/,
    zona: (page) => page.locator('app-admin-errors-tab fin-zona-de-carga'),
    vacia: { cuerpo: paginaVacia, texto: vacioDeTabla },
    datos: async (page, zona) => {
      const items = listaDe(await leerApi(page, '/api/v1/superadmin/errors'));
      if (!items.length) await expect(zona.getByText(vacioDeTabla)).toBeVisible();
      else await expect(zona.locator('tbody tr').first()).toBeVisible();
    },
  },
  {
    nombre: 'Administración · Auditoría',
    ruta: 'admin?tab=audit',
    retrasa: /\/api\/v1\/superadmin\/audit(\?|$)/,
    zona: (page) => page.locator('app-admin-audit-tab fin-zona-de-carga'),
    vacia: { cuerpo: paginaVacia, texto: vacioDeTabla },
    datos: async (page, zona) => {
      const items = listaDe(await leerApi(page, '/api/v1/superadmin/audit'));
      expect(items.length).toBeGreaterThan(0);
      await expect(zona.locator('tbody tr').first()).toBeVisible();
    },
  },
  {
    nombre: 'Administración · Banderas',
    ruta: 'admin?tab=flags',
    retrasa: /\/api\/v1\/superadmin\/feature-flags(\?|$)/,
    zona: (page) => page.locator('app-admin-flags-tab fin-zona-de-carga'),
    vacia: { cuerpo: [], texto: vacioDeTabla },
    datos: async (page, zona) => {
      const items = listaDe(await leerApi(page, '/api/v1/superadmin/feature-flags'));
      expect(items.length).toBeGreaterThan(0);
      await expect(zona.locator('tbody tr').first()).toBeVisible();
    },
  },
  {
    nombre: 'Personas',
    ruta: 'people',
    retrasa: /\/api\/v1\/people\/debt-positions/,
    zona: (page) => page.locator('app-people-tab fin-zona-de-carga').last(),
    vacia: { cuerpo: [] },
    datos: async (page, zona) => {
      await expect(zona.getByText(nombres.persona).first()).toBeVisible();
    },
  },
  {
    nombre: 'Patrimonio',
    ruta: 'portfolio',
    retrasa: /\/api\/v1\/investments(\?|$)/,
    zona: (page) => page.locator('app-portfolio-tab fin-zona-de-carga').last(),
    vacia: { cuerpo: [], texto: vacioDeTabla },
    datos: (page, zona) => tablaConNombres(page, zona, '/api/v1/investments', 'name'),
  },
  {
    nombre: 'Calendario',
    ruta: 'calendar',
    retrasa: /\/api\/v1\/(calendar\/projected|recurrences)(\?|$)/,
    zona: (page) => page.locator('[data-tour=calendario-agenda] fin-zona-de-carga'),
    vacia: { cuerpo: [] },
    datos: async (page, zona) => {
      const recurrentes = listaDe(await leerApi(page, '/api/v1/recurrences'));
      if (recurrentes.length) await expect(zona.getByText(String(recurrentes[0].name)).first()).toBeVisible();
      else await expect(zona).toBeVisible();
    },
  },
  {
    nombre: 'Planificación',
    retardoMs: 4000,
    ruta: 'planning',
    retrasa: /\/api\/v1\/movements\/search(\?|$)/,
    zona: (page) => page.locator('app-planning-tab fin-zona-de-carga').first(),
    datos: async (_page, zona) => {
      await expect(zona.locator('article').first()).toBeVisible();
    },
  },
  {
    nombre: 'Notificaciones',
    conDatosPrevios: true,
    ruta: 'notifications',
    retrasa: /\/api\/v1\/notifications(\?|$)/,
    zona: (page) => page.locator('app-notifications-tab fin-zona-de-carga'),
    vacia: { cuerpo: [], texto: /Estás al día/ },
    datos: async (page, zona) => {
      const avisos = listaDe(await leerApi(page, '/api/v1/notifications'));
      if (avisos.length) await expect(zona.locator('li').first()).toBeVisible();
      else await expect(zona.getByText(/Estás al día/)).toBeVisible();
    },
  },
  {
    nombre: 'Preferencias · Organización',
    ruta: 'settings?section=organization',
    retrasa: /\/api\/v1\/organization\/members(\?|$)/,
    zona: (page) => page.locator('[hlmTabsContent=organization] fin-zona-de-carga').first(),
    vacia: { cuerpo: [] },
    datos: async (page, zona) => {
      const miembros = listaDe(await leerApi(page, '/api/v1/organization/members'));
      expect(miembros.length).toBeGreaterThan(0);
      await expect(zona.getByText(String(miembros[0].email)).first()).toBeVisible();
    },
  },
  {
    nombre: 'Preferencias · Presupuestos',
    ruta: 'settings?section=budgets',
    retrasa: /\/api\/v1\/budgets(\?|$)/,
    zona: (page) => page.locator('[data-slot=presupuestos] fin-zona-de-carga'),
    vacia: { cuerpo: [] },
    datos: async (_page, zona) => {
      await expect(zona.locator('li').first()).toBeVisible();
    },
  },
  {
    nombre: 'Cuentas',
    ruta: 'accounts',
    retrasa: /\/api\/v1\/movements\/search(\?|$)/,
    zona: (page) => page.locator('[data-tour=cuentas-tabla] fin-zona-de-carga'),
    datos: async (page, zona) => {
      const respuesta = await page.request.post(`${apiUrl}/api/v1/movements/search`, {
        data: { page: { page: 1, size: 25 }, sortBy: 0, direction: 1, filter: {} },
      });
      const movimientos = listaDe(await respuesta.json());
      expect(movimientos.length).toBeGreaterThan(0);
      await expect(zona.getByText(String(movimientos[0].description)).first()).toBeVisible();
    },
  },
];

for (const pantalla of pantallas) {
  test.describe(`Carga · ${pantalla.nombre}`, () => {
    test(`CAR-10 ${pantalla.nombre}: esqueleto con aria-busy mientras se retrasa y luego datos reales`, async ({
      page,
    }) => {
      await retrasar(page, pantalla.retrasa, pantalla.retardoMs);
      await irSinEsperar(page, pantalla.ruta);
      const zona = pantalla.zona(page);
      await expect(zona).toHaveAttribute('aria-busy', 'true', { timeout: 15_000 });
      await expect(zona.locator('[role=status]').first()).toBeAttached();
      if (pantalla.conDatosPrevios) {
        await expect(zona.locator('[data-testid=barra-de-zona]')).toBeVisible();
      } else {
        await expect(esqueletoEn(zona).first()).toBeVisible();
        await expect(esqueletoEn(zona).first()).toHaveAttribute('aria-busy', 'true');
      }
      await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
      await expect(esqueletoEn(zona)).toHaveCount(0);
      await pantalla.datos(page, zona);
    });

    if (pantalla.vacia) {
      const vacia = pantalla.vacia;
      test(`CAR-11 ${pantalla.nombre}: respuesta vacía muestra el estado vacío y no el esqueleto`, async ({ page }) => {
        await page.route(pantalla.retrasa, (ruta) =>
          ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vacia.cuerpo) }),
        );
        await irSinEsperar(page, pantalla.ruta);
        const zona = pantalla.zona(page);
        await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
        await expect(esqueletoEn(zona)).toHaveCount(0);
        if (vacia.texto) await expect(zona.getByText(vacia.texto).first()).toBeVisible();
      });
    }
  });
}

test.describe('Refresco con datos', () => {
  test('CAR-20 Cuentas: cambiar las filas por página no vacía la tabla ni la cambia por un esqueleto', async ({
    page,
  }) => {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    const zona = page.locator('[data-tour=cuentas-tabla] fin-zona-de-carga');
    await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    expect(await zona.locator('tbody tr').count()).toBeGreaterThan(0);
    await retrasar(page, /\/api\/v1\/movements\/search(\?|$)/, 3000);
    await elegir(zona, 'Filas por página', '10');
    await expect(zona).toHaveAttribute('aria-busy', 'true');
    await expect(esqueletoEn(zona)).toHaveCount(0);
    expect(await zona.locator('tbody tr').count()).toBeGreaterThan(0);
    await expect(zona.locator('[data-testid=barra-de-zona]')).toBeVisible();
    await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    expect(await zona.locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('CAR-21 Notificaciones: recargar la lista no la vacía ni la cambia por un esqueleto', async ({ page }) => {
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    const zona = page.locator('app-notifications-tab fin-zona-de-carga');
    await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    const total = await zona.locator('li').count();
    await retrasar(page, /\/api\/v1\/notifications(\?|$)/, 3000);
    await page.evaluate(() => {
      const ng = (window as any).ng;
      ng.getComponent(document.querySelector('app-notifications-tab')).notifications.recargar();
    });
    await expect(zona).toHaveAttribute('aria-busy', 'true');
    await expect(esqueletoEn(zona)).toHaveCount(0);
    expect(await zona.locator('li').count()).toBe(total);
    await expect(zona).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    expect(await zona.locator('li').count()).toBe(total);
  });
});
