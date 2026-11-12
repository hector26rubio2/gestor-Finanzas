import type { Page } from '@playwright/test';
import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, buscarMovimientos, dialogo, elegir, elegirPendientes, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;
const RUTA_ATOMICA = '**/api/v1/operations/shared-purchases';
const RUTA_ATOMICA_RE = /[/]api[/]v1[/]operations[/]shared-purchases/;

test.describe.configure({ mode: 'serial' });

interface CompraCompartida {
  id: string;
  purchaseMovement: string;
  description: string | null;
}

async function comprasCompartidasDe(page: Page, descripcion: string): Promise<CompraCompartida[]> {
  const respuesta = await page.request.get(`${apiUrl}/api/v1/shared-purchases`);
  expect(respuesta.ok()).toBeTruthy();
  return ((await respuesta.json()) as CompraCompartida[]).filter((compra) => compra.description === descripcion);
}

async function llenarCompraParaTercero(page: Page, descripcion: string): Promise<void> {
  const formulario = dialogo(page);
  await formulario.waitFor({ state: 'visible' });
  await formulario.locator('input[name=amount]').fill('70000');
  await elegir(formulario, 'Cuenta o tarjeta:', nombres.tarjeta);
  await elegir(formulario, 'Categoría:', nombres.mercado);
  await elegir(formulario, 'Responsabilidad:', new RegExp(nombres.persona));
  await elegirPendientes(formulario);
  await formulario.locator('input[name=description]').fill(descripcion);
}

test.describe('Compra compartida atómica', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('COMP-01 registrar una compra compartida deja una sola compra y un solo reparto tras recargar', async ({
    page,
    vigilancia,
  }) => {
    const descripcion = `E2E compartida atomica ${corrida}`;
    await atajo(page, 'n', 'g');
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 70_000,
      descripcion,
      selecciones: {
        'Cuenta o tarjeta:': nombres.tarjeta,
        'Categoría:': nombres.mercado,
        'Responsabilidad:': new RegExp(nombres.persona),
      },
    });
    expect(resumen).toBe('POST /api/v1/operations/shared-purchases');

    await page.reload();

    const compras = (await buscarMovimientos(page, descripcion)).filter((movimiento) => movimiento.kind === 20);
    expect(compras).toHaveLength(1);
    const repartos = await comprasCompartidasDe(page, descripcion);
    expect(repartos).toHaveLength(1);
    expect(repartos[0].purchaseMovement).toBe(compras[0].id);
  });

  test('COMP-02 si el endpoint falla el formulario queda abierto con el error y no se crea nada', async ({
    page,
    vigilancia,
  }) => {
    const descripcion = `E2E compartida fallida ${corrida}`;
    await page.route(RUTA_ATOMICA, (ruta) => ruta.abort('failed'));
    await atajo(page, 'n', 'g');
    await llenarCompraParaTercero(page, descripcion);
    const formulario = dialogo(page);

    await formulario.locator('button[type=submit]').click();

    await expect(formulario.getByRole('alert')).toBeVisible();
    await expect(formulario).toBeVisible();
    vigilancia.aceptarErroresEsperados();
    expect(await buscarMovimientos(page, descripcion)).toHaveLength(0);
    expect(await comprasCompartidasDe(page, descripcion)).toHaveLength(0);

    await page.unroute(RUTA_ATOMICA);
    await page.route(RUTA_ATOMICA, (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 500, code: 'internal.error', title: 'Error' }),
      }),
    );
    const respuesta500 = page.waitForResponse((r) => RUTA_ATOMICA_RE.test(r.url()) && r.status() === 500);
    await formulario.locator('button[type=submit]').click();
    await respuesta500;
    await expect(formulario.getByRole('alert')).toBeVisible();
    await expect(formulario).toBeVisible();
    vigilancia.aceptarErroresEsperados();
    expect(await buscarMovimientos(page, descripcion)).toHaveLength(0);
    expect(await comprasCompartidasDe(page, descripcion)).toHaveLength(0);
  });

  test('COMP-03 un segundo clic rápido al guardar no duplica la compra', async ({ page, vigilancia }) => {
    const descripcion = `E2E compartida doble clic ${corrida}`;
    await page.route(RUTA_ATOMICA, async (ruta) => {
      await new Promise((listo) => setTimeout(listo, 600));
      await ruta.continue();
    });
    await atajo(page, 'n', 'g');
    await llenarCompraParaTercero(page, descripcion);
    const formulario = dialogo(page);
    const marca = vigilancia.marca();

    await formulario.locator('button[type=submit]').dblclick({ force: true });
    await expect(formulario).toBeHidden();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /shared-purchases/).length).toBeGreaterThan(0);

    const compras = (await buscarMovimientos(page, descripcion)).filter((movimiento) => movimiento.kind === 20);
    expect(compras).toHaveLength(1);
    expect(await comprasCompartidasDe(page, descripcion)).toHaveLength(1);
  });
});
