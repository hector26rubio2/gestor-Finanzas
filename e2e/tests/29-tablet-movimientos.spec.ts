import type { Page } from '@playwright/test';
import { analizarAxe } from '../support/auditoria';
import { expect, test } from '../support/fixtures';
import { ir, panelLateral } from '../support/ui';

const CABECERAS_DE_PRIORIDAD_1 = ['Fecha', 'Descripción', 'Importe', 'Cuenta o tarjeta'];
const CABECERAS_DE_ESCRITORIO = [
  'Fecha',
  'Descripción',
  'Importe',
  'Cuenta o tarjeta',
  'Crédito o débito',
  'Entrada / salida',
  'Moneda / tasa',
  'Cuotas / préstamo',
  'Responsabilidad',
  'Recurrencia',
];

const TABLETAS = [
  { nombre: 'tablet vertical', ancho: 768, alto: 1024, filasMinimas: 10 },
  { nombre: 'tablet horizontal', ancho: 1024, alto: 768, filasMinimas: 6 },
];

async function abrirMovimientos(page: Page): Promise<void> {
  await ir(page, 'movements');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main table tbody tr').first()).toBeVisible();
}

const cabeceras = (page: Page): Promise<string[]> =>
  page
    .locator('main table thead th')
    .evaluateAll((celdas) =>
      celdas.filter((c) => (c as HTMLElement).offsetParent !== null).map((c) => (c.textContent ?? '').trim()),
    );

async function filasCompletamenteVisibles(page: Page): Promise<number> {
  return page.evaluate(() => {
    const contenedor = document.querySelector('[data-testid=table-scroll]')!.getBoundingClientRect();
    const arriba = Math.max(contenedor.top, 0);
    const abajo = Math.min(contenedor.bottom, window.innerHeight);
    return [...document.querySelectorAll('main table tbody tr')].filter((fila) => {
      const caja = fila.getBoundingClientRect();
      return caja.height > 0 && caja.top >= arriba - 1 && caja.bottom <= abajo + 1;
    }).length;
  });
}

for (const tableta of TABLETAS) {
  test.describe(`Movimientos en ${tableta.nombre} ${tableta.ancho}x${tableta.alto}`, () => {
    test.use({ viewport: { width: tableta.ancho, height: tableta.alto }, hasTouch: true });

    test.beforeEach(async ({ page }) => {
      await abrirMovimientos(page);
    });

    test(`TAB-01 sin scroll horizontal de la página ni de la tabla`, async ({ page }) => {
      const medidas = await page.evaluate(() => {
        const documento = document.documentElement;
        const tabla = document.querySelector('[data-testid=table-scroll]')!;
        return {
          paginaScroll: documento.scrollWidth,
          paginaVista: documento.clientWidth,
          tablaScroll: tabla.scrollWidth,
          tablaVista: tabla.clientWidth,
        };
      });
      expect(medidas.paginaScroll).toBeLessThanOrEqual(medidas.paginaVista);
      expect(medidas.tablaScroll).toBeLessThanOrEqual(medidas.tablaVista);
    });

    test(`TAB-08 una descripción y una cuenta largas no desbordan la tabla`, async ({ page }) => {
      const medidas = await page.evaluate(() => {
        const celdas = [...document.querySelectorAll('main table tbody tr')[0].querySelectorAll('td')].filter(
          (celda) => (celda as HTMLElement).offsetParent !== null,
        );
        celdas[1].textContent = 'E2E compartida doble clic 1731400000000 con una descripción larga de prueba';
        celdas[3].textContent = 'Cuenta de ahorros personal de la corrida e2e con nombre largo';
        const tabla = document.querySelector('[data-testid=table-scroll]')!;
        return { tablaScroll: tabla.scrollWidth, tablaVista: tabla.clientWidth };
      });
      expect(medidas.tablaScroll).toBeLessThanOrEqual(medidas.tablaVista);
    });

    test(`TAB-02 la tabla muestra solo las cuatro columnas de prioridad 1`, async ({ page }) => {
      expect(await cabeceras(page)).toEqual(CABECERAS_DE_PRIORIDAD_1);
    });

    test(`TAB-03 caben al menos ${tableta.filasMinimas} filas a la vista`, async ({ page }) => {
      expect(await filasCompletamenteVisibles(page)).toBeGreaterThanOrEqual(tableta.filasMinimas);
    });

    test(`TAB-04 el detalle trae los datos de las columnas ocultas`, async ({ page }) => {
      await page
        .locator('main table tbody tr')
        .first()
        .getByRole('button', { name: /Ver detalle/ })
        .first()
        .click();
      const detalle = panelLateral(page);
      for (const dato of [
        'Crédito o débito',
        'Entrada / salida',
        'Responsabilidad',
        'Cuotas',
        'Recurrencia',
        'Moneda original',
      ])
        await expect(detalle.getByText(dato, { exact: true })).toBeVisible();
    });

    test(`TAB-05 los KPI se pliegan a una línea y se despliegan con un botón táctil`, async ({ page }) => {
      const resumen = page.getByTestId('movimientos-kpis-resumen');
      await expect(resumen).toBeVisible();
      await expect(page.locator('fin-kpi-grid')).toHaveCount(0);
      const boton = resumen.getByRole('button', { name: /indicadores/i });
      const caja = (await boton.boundingBox())!;
      expect(caja.height).toBeGreaterThanOrEqual(44);
      await boton.click();
      await expect(page.locator('fin-kpi-grid')).toBeVisible();
      await expect(boton).toHaveAttribute('aria-expanded', 'true');
    });

    test(`TAB-06 axe sin fallos graves`, async ({ page }) => {
      const graves = (await analizarAxe(page)).filter((h) => h.impacto === 'serious' || h.impacto === 'critical');
      expect(graves).toEqual([]);
    });
  });
}

test.describe('Movimientos en escritorio 1280x800 (control)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('TAB-07 conserva todas las cabeceras y la franja completa de KPI', async ({ page }) => {
    await abrirMovimientos(page);
    expect(await cabeceras(page)).toEqual(CABECERAS_DE_ESCRITORIO);
    await expect(page.locator('fin-kpi-grid')).toBeVisible();
    await expect(page.getByTestId('movimientos-kpis-resumen').getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
