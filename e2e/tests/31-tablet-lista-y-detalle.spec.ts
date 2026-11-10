import type { Locator, Page } from '@playwright/test';
import { analizarAxe } from '../support/auditoria';
import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, buscarMovimientos, esperarMovimiento, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

const filas = (page: Page): Locator => page.locator('main table tbody tr');
const detalle = (page: Page): Locator => page.locator('main').getByRole('complementary');
const telon = (page: Page): Locator => page.locator('[data-slot=sheet-overlay], .cdk-overlay-backdrop');
const botonDeFila = (page: Page, indice: number): Locator =>
  filas(page)
    .nth(indice)
    .getByRole('button', { name: /Ver detalle/ })
    .first();
const anchoDeLaTabla = async (page: Page): Promise<number> => (await page.locator('main table').boundingBox())!.width;

async function abrirMovimientos(page: Page): Promise<void> {
  await ir(page, 'movements');
  await page.waitForLoadState('networkidle');
  await expect(filas(page).first()).toBeVisible();
}

async function sinScrollHorizontal(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tabla = document.querySelector('[data-testid=table-scroll]')!;
        return {
          pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          tabla: tabla.scrollWidth - tabla.clientWidth,
        };
      }),
    )
    .toEqual({ pagina: 0, tabla: 0 });
}

test.describe('Lista y detalle en tablet horizontal 1024x768', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await abrirMovimientos(page);
  });

  test('LYD-01 la tabla y el detalle se ven a la vez, sin solaparse, sin telón y sin scroll horizontal', async ({
    page,
  }) => {
    const anchoSinDetalle = await anchoDeLaTabla(page);
    await botonDeFila(page, 0).tap();
    await expect(detalle(page)).toBeVisible();
    await expect(page.locator('main table')).toBeVisible();
    const tabla = (await page.locator('main table').boundingBox())!;
    const panel = (await detalle(page).boundingBox())!;
    expect(tabla.x + tabla.width).toBeLessThanOrEqual(panel.x + 1);
    expect(panel.width).toBeGreaterThanOrEqual(340);
    expect(panel.width).toBeLessThanOrEqual(420);
    expect(panel.x + panel.width).toBeLessThanOrEqual(1024);
    expect(tabla.width).toBeLessThan(anchoSinDetalle);
    await expect(telon(page)).toHaveCount(0);
    await expect(page.locator('[data-slot=sheet-content]')).toHaveCount(0);
    await sinScrollHorizontal(page);
    const cabeceras = await page
      .locator('main table thead th')
      .evaluateAll((celdas) =>
        celdas.filter((c) => (c as HTMLElement).offsetParent !== null).map((c) => (c.textContent ?? '').trim()),
      );
    expect(cabeceras.length).toBeGreaterThanOrEqual(3);
    for (const cabecera of ['Fecha', 'Descripción', 'Importe']) expect(cabeceras).toContain(cabecera);
  });

  test('LYD-02 tocar otra fila cambia el detalle sin cerrarlo y marca la fila elegida', async ({ page }) => {
    await botonDeFila(page, 0).tap();
    await expect(detalle(page)).toBeVisible();
    const antes = await detalle(page).innerText();
    const panel = await detalle(page).elementHandle();
    await botonDeFila(page, 2).tap();
    await expect(detalle(page)).toBeVisible();
    await expect.poll(() => detalle(page).innerText()).not.toBe(antes);
    expect(await panel!.evaluate((nodo) => nodo.isConnected)).toBe(true);
    await expect(page.locator('main table tbody tr[aria-current=true]')).toHaveCount(1);
    await expect(filas(page).nth(2)).toHaveAttribute('aria-current', 'true');
    await expect(filas(page).nth(0)).not.toHaveAttribute('aria-current', 'true');
  });

  test('LYD-03 Escape y el botón cierran el detalle y la tabla recupera el ancho', async ({ page }) => {
    const ancho = await anchoDeLaTabla(page);
    await botonDeFila(page, 0).tap();
    await expect(detalle(page)).toBeVisible();
    expect(await anchoDeLaTabla(page)).toBeLessThan(ancho);
    await page.keyboard.press('Escape');
    await expect(detalle(page)).toHaveCount(0);
    await expect.poll(() => anchoDeLaTabla(page)).toBeCloseTo(ancho, 0);

    await botonDeFila(page, 1).tap();
    await expect(detalle(page)).toBeVisible();
    const cerrar = detalle(page).getByRole('button', { name: 'Cerrar' });
    const caja = (await cerrar.boundingBox())!;
    expect(caja.height).toBeGreaterThanOrEqual(44);
    expect(caja.width).toBeGreaterThanOrEqual(44);
    await cerrar.tap();
    await expect(detalle(page)).toHaveCount(0);
    await expect(page.locator('main table tbody tr[aria-current=true]')).toHaveCount(0);
    await expect.poll(() => anchoDeLaTabla(page)).toBeCloseTo(ancho, 0);
  });

  test('LYD-04 el foco pasa al detalle al abrirlo y Escape lo devuelve a la fila', async ({ page }) => {
    await botonDeFila(page, 0).focus();
    await page.keyboard.press('Enter');
    await expect(detalle(page)).toBeVisible();
    await expect(detalle(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(detalle(page)).toHaveCount(0);
    await expect(botonDeFila(page, 0)).toBeFocused();
  });

  test('LYD-05 axe sin fallos graves con el detalle abierto', async ({ page }) => {
    await botonDeFila(page, 0).tap();
    await expect(detalle(page)).toBeVisible();
    const graves = (await analizarAxe(page)).filter((h) => h.impacto === 'serious' || h.impacto === 'critical');
    expect(graves).toEqual([]);
  });

  test('LYD-06 Reversar desde el panel acoplado revierte el movimiento', async ({ page, vigilancia }) => {
    const descripcion = `E2E lista y detalle reversar ${corrida}`;
    await atajo(page, 'n', 'g');
    await guardarMovimiento(page, vigilancia, {
      monto: 23_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 23_000);

    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(descripcion);
    await buscador.press('Enter');
    await expect(filas(page).filter({ hasText: descripcion })).toHaveCount(1);
    await botonDeFila(page, 0).tap();
    await expect(detalle(page)).toBeVisible();
    const reversar = detalle(page).getByRole('button', { name: 'Reversar', exact: true });
    await expect(reversar).toBeVisible();
    expect((await reversar.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const marca = vigilancia.marca();
    await reversar.tap();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reversar movimiento' }).tap();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*reversal/).length).toBe(1);
    await expect.poll(async () => (await buscarMovimientos(page, descripcion)).some((m) => m.reversedBy)).toBe(true);
  });
});

for (const control of [
  { nombre: 'tablet vertical', ancho: 768, alto: 1024 },
  { nombre: 'escritorio', ancho: 1280, alto: 800 },
]) {
  test.describe(`Detalle superpuesto en ${control.nombre} ${control.ancho}x${control.alto} (control)`, () => {
    test.use({ viewport: { width: control.ancho, height: control.alto }, hasTouch: true });

    test('LYD-07 el detalle se abre encima como hoy y no hay panel acoplado', async ({ page }) => {
      await abrirMovimientos(page);
      await botonDeFila(page, 0).tap();
      await expect(page.locator('[data-slot=sheet-content]')).toBeVisible();
      await expect(page.locator('main').getByRole('complementary')).toHaveCount(0);
    });
  });
}
