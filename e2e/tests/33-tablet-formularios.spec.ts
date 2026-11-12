import type { Locator, Page } from '@playwright/test';
import { analizarAxe } from '../support/auditoria';
import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, dialogo, elegir, esperarMovimiento, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;
const ANCHO_DE_HOJA = 480;

const TABLETAS = [
  { nombre: 'tablet horizontal', ancho: 1024, alto: 768 },
  { nombre: 'tablet vertical', ancho: 768, alto: 1024 },
];

const botonNuevoMovimiento = (page: Page): Locator => page.getByRole('button', { name: 'Nuevo movimiento' }).first();

async function medidas(locator: Locator) {
  let anterior = '';
  await expect
    .poll(async () => {
      const actual = JSON.stringify(await locator.boundingBox());
      const quieta = actual === anterior;
      anterior = actual;
      return quieta;
    })
    .toBe(true);
  return (await locator.boundingBox())!;
}

async function cuentaAbierta(page: Page, tipo?: string): Promise<Locator> {
  await atajo(page, 'n', 'c');
  const formulario = dialogo(page);
  await expect(formulario).toBeVisible();
  if (tipo) await elegir(formulario, 'Tipo de cuenta', new RegExp(`^\\s*${tipo}\\s*$`));
  return formulario;
}

async function sinScrollHorizontal(page: Page): Promise<void> {
  const [pagina, vista] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(pagina).toBeLessThanOrEqual(vista);
}

for (const tableta of TABLETAS) {
  test.describe(`Formularios en ${tableta.nombre} ${tableta.ancho}x${tableta.alto}`, () => {
    test.use({ viewport: { width: tableta.ancho, height: tableta.alto }, hasTouch: true });

    test(`HOJ-01 «Nuevo movimiento» es una hoja pegada a la derecha de 480 px y a toda la altura`, async ({ page }) => {
      await ir(page, 'movements');
      await expect(page.locator('main table tbody tr').first()).toBeVisible();
      const tabla = await medidas(page.locator('main table').first());
      await botonNuevoMovimiento(page).click();
      const hoja = dialogo(page);
      await expect(hoja).toBeVisible();
      await expect(hoja).toHaveAttribute('data-superficie', 'hoja');
      const caja = await medidas(hoja);
      expect(Math.abs(caja.x + caja.width - tableta.ancho)).toBeLessThanOrEqual(2);
      expect(Math.abs(caja.width - ANCHO_DE_HOJA)).toBeLessThanOrEqual(2);
      expect(Math.abs(caja.height - tableta.alto)).toBeLessThanOrEqual(2);
      expect(caja.y).toBeLessThanOrEqual(1);
      expect(tabla.x).toBeLessThan(caja.x);
      await expect(page.locator('main table tbody tr').first()).toBeVisible();
      await sinScrollHorizontal(page);
    });

    test(`HOJ-02 Guardar y Cancelar quedan visibles aunque el formulario sea largo`, async ({ page }) => {
      await ir(page, 'accounts');
      const hoja = await cuentaAbierta(page, 'Crédito');
      const guardar = hoja.locator('button[type=submit]');
      const cancelar = hoja.getByRole('button', { name: 'Cancelar' });
      const desborda = await hoja.evaluate((nodo) =>
        [...nodo.querySelectorAll<HTMLElement>('*')].some(
          (hijo) => hijo.scrollHeight > hijo.clientHeight + 40 && getComputedStyle(hijo).overflowY !== 'visible',
        ),
      );
      expect(desborda, 'el cuerpo de la hoja tiene scroll propio').toBe(true);
      for (const boton of [guardar, cancelar]) {
        await expect(boton).toBeInViewport({ ratio: 1 });
        expect((await medidas(boton)).height).toBeGreaterThanOrEqual(44);
      }
      const barra = await medidas(hoja.locator('footer[finAcciones]'));
      expect(barra.y + barra.height).toBeGreaterThan(tableta.alto - 40);
      await sinScrollHorizontal(page);
    });

    test(`HOJ-03 el movimiento con tarjeta conserva la barra de acciones a la vista`, async ({ page }) => {
      await ir(page, 'movements');
      await atajo(page, 'n', 'g');
      const hoja = dialogo(page);
      await elegir(hoja, 'Cuenta o tarjeta:', nombres.tarjeta);
      await expect(hoja.locator('button[type=submit]')).toBeInViewport({ ratio: 1 });
      await expect(hoja.getByRole('button', { name: 'Cancelar' })).toBeInViewport({ ratio: 1 });
    });

    test(`HOJ-04 registrar un gasto completo desde la hoja lo guarda y aparece en la tabla`, async ({
      page,
      vigilancia,
    }) => {
      const descripcion = `E2E hoja gasto ${tableta.ancho} ${corrida}`;
      await ir(page, 'movements');
      await atajo(page, 'n', 'g');
      await guardarMovimiento(page, vigilancia, {
        monto: 41_000,
        descripcion,
        selecciones: { 'Categoría:': nombres.mercado },
      });
      await esperarMovimiento(page, descripcion, 41_000);
      const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
      await buscador.fill(descripcion);
      await buscador.press('Enter');
      await expect(page.locator('main table tbody').getByText(descripcion).first()).toBeVisible();
    });

    test(`HOJ-05 Escape cierra la hoja de movimiento y devuelve el foco al botón`, async ({ page }) => {
      await ir(page, 'movements');
      const boton = botonNuevoMovimiento(page);
      await boton.click();
      const hoja = dialogo(page);
      await expect(hoja).toBeVisible();
      await expect(page.locator('[role=dialog][aria-modal=true]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(hoja).toBeHidden();
      await expect(boton).toBeFocused();
    });

    test(`HOJ-06 «Nueva cuenta» es hoja lateral y Escape devuelve el foco al botón`, async ({ page }) => {
      await ir(page, 'accounts');
      const boton = page.getByRole('button', { name: 'Nueva cuenta' }).first();
      await boton.click();
      const hoja = dialogo(page);
      await expect(hoja).toHaveAttribute('data-superficie', 'hoja');
      const caja = await medidas(hoja);
      expect(Math.abs(caja.width - ANCHO_DE_HOJA)).toBeLessThanOrEqual(2);
      expect(Math.abs(caja.x + caja.width - tableta.ancho)).toBeLessThanOrEqual(2);
      await expect(hoja.locator('button[type=submit]')).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
      await expect(hoja).toBeHidden();
      await expect(boton).toBeFocused();
    });

    test(`HOJ-07 «Inversión» es hoja lateral y Escape devuelve el foco al botón`, async ({ page }) => {
      await ir(page, 'portfolio');
      const boton = page.getByRole('button', { name: 'Inversión', exact: true });
      await boton.click();
      const hoja = dialogo(page);
      await expect(hoja).toHaveAttribute('data-superficie', 'hoja');
      const caja = await medidas(hoja);
      expect(Math.abs(caja.width - ANCHO_DE_HOJA)).toBeLessThanOrEqual(2);
      await expect(hoja.locator('button[type=submit]')).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
      await expect(hoja).toBeHidden();
      await expect(boton).toBeFocused();
    });

    test(`HOJ-08 los controles táctiles de la hoja miden al menos 44 px y los selectores caben en pantalla`, async ({
      page,
    }) => {
      await ir(page, 'movements');
      await atajo(page, 'n', 'g');
      const hoja = dialogo(page);
      await expect(hoja).toBeVisible();
      const chicos = await hoja.evaluate((nodo) =>
        [
          ...nodo.querySelectorAll<HTMLElement>(
            'button, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), [data-slot=select-trigger]',
          ),
        ]
          .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0)
          .filter((el) => el.getBoundingClientRect().height < 43.5)
          .map((el) => `${el.tagName} ${el.getAttribute('aria-label') ?? el.getAttribute('name') ?? ''}`),
      );
      expect(chicos).toEqual([]);
      await hoja.locator('[data-slot=select-trigger]').first().click();
      const lista = page.locator('[role=listbox]').first();
      await expect(lista).toBeVisible();
      const caja = await medidas(lista);
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.y).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(tableta.ancho + 1);
      expect(caja.y + caja.height).toBeLessThanOrEqual(tableta.alto + 1);
      await page.keyboard.press('Escape');
    });

    test(`HOJ-09 axe sin fallos graves con la hoja abierta`, async ({ page }) => {
      await ir(page, 'accounts');
      await cuentaAbierta(page);
      const graves = (await analizarAxe(page)).filter((h) => h.impacto === 'serious' || h.impacto === 'critical');
      expect(graves).toEqual([]);
    });
  });
}

test.describe('Formularios en escritorio 1280x800 (control)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('HOJ-10 el formulario de movimiento sigue siendo un diálogo centrado', async ({ page }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await expect(formulario).toBeVisible();
    await expect(formulario).toHaveAttribute('data-superficie', 'dialogo');
    const caja = await medidas(formulario);
    expect(Math.abs(caja.x + caja.width / 2 - 640)).toBeLessThanOrEqual(2);
    expect(caja.x + caja.width).toBeLessThan(1280 - 100);
    expect(caja.height).toBeLessThan(800);
  });

  test('HOJ-11 el formulario de cuenta sigue siendo un diálogo centrado', async ({ page }) => {
    await ir(page, 'accounts');
    const formulario = await cuentaAbierta(page);
    await expect(formulario).toHaveAttribute('data-superficie', 'dialogo');
    const caja = await medidas(formulario);
    expect(Math.abs(caja.x + caja.width / 2 - 640)).toBeLessThanOrEqual(2);
  });
});
