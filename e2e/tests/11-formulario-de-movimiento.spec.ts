import type { Page } from '@playwright/test';
import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, buscarMovimientos, dialogo, esperarMovimiento, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

async function opcionesDeTipo(page: Page): Promise<string[]> {
  const formulario = dialogo(page);
  await formulario.locator('[data-slot=select-trigger][aria-label^="Tipo"]').first().click();
  const opciones = (await page.locator('[role=option]').allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return opciones;
}

test.describe.configure({ mode: 'serial' });

test.describe('Formulario de movimiento', () => {
  test('FRM-01 el propietario ve préstamo a otra persona en gastos', async ({ page }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    expect(await opcionesDeTipo(page), 'tipos de gasto').toContain('Préstamo a otra persona');
  });

  test('FRM-01b el propietario ve préstamo recibido y crédito en ingresos', async ({ page }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 'i');
    expect(await opcionesDeTipo(page), 'tipos de ingreso').toEqual(
      expect.arrayContaining(['Préstamo que me hicieron', 'Crédito de una entidad']),
    );
  });

  test('FRM-02 editar el monto de un gasto lo guarda o no deja editarlo', async ({ page, vigilancia }) => {
    const descripcion = `E2E editar monto ${corrida}`;
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    await guardarMovimiento(page, vigilancia, {
      monto: 30_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 30_000);

    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(descripcion);
    await buscador.press('Enter');
    const fila = page.locator('main table tbody tr').filter({ hasText: descripcion });
    await expect(fila).toHaveCount(1);
    await fila.getByRole('button', { name: /Ver detalle/ }).click();
    await page
      .getByRole('button', { name: /Reclasificar|Editar/ })
      .first()
      .click();

    const formulario = dialogo(page);
    const monto = formulario.locator('input[name=amount]');
    await expect(monto).toBeVisible();
    if (await monto.isEditable()) {
      await monto.fill('99000');
      await formulario.locator('button[type=submit]').click();
      await expect(formulario).toBeHidden();
      await expect
        .poll(async () => (await buscarMovimientos(page, descripcion)).map((m) => Number(m.amount.original.amount)), {
          message: 'el monto editado debe quedar guardado',
        })
        .toEqual([99_000]);
    }
  });
});
