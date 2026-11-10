import type { Page } from '@playwright/test';
import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { hoy, sumarDias } from '../support/tablero';
import { atajo, buscarMovimientos, dialogo, esperarMovimiento, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

async function saldos(page: Page): Promise<Record<string, number>> {
  const respuesta = await page.request.get(
    `${apiUrl}/api/v1/dashboard?from=${sumarDias(hoy(), -1)}&to=${sumarDias(hoy(), 1)}`,
  );
  expect(respuesta.ok()).toBeTruthy();
  const { accounts } = (await respuesta.json()) as {
    accounts: { account: { name: string }; balance: { amount: string } }[];
  };
  return Object.fromEntries(accounts.map((c) => [c.account.name, Number(c.balance.amount)]));
}

async function abrirEdicionDeUnaPata(page: Page, descripcion: string): Promise<void> {
  await ir(page, 'movements');
  const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
  await buscador.fill(descripcion);
  await buscador.press('Enter');
  const filas = page.locator('main table tbody tr').filter({ hasText: descripcion });
  await expect(filas.first()).toBeVisible();
  await filas
    .first()
    .getByRole('button', { name: /Ver detalle/ })
    .click();
  await page
    .getByRole('button', { name: /Reclasificar|Editar/ })
    .first()
    .click();
  await expect(dialogo(page)).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('Editar una transferencia', () => {
  const descripcion = `E2E transferencia editable ${corrida}`;
  const editada = `E2E transferencia renombrada ${corrida}`;
  let saldosAntes: Record<string, number>;

  test('TRF-01 crear la transferencia que se va a editar', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 't');
    await guardarMovimiento(page, vigilancia, {
      monto: 20_000,
      descripcion,
      selecciones: { 'Cuenta destino:': nombres.corriente },
    });
    await esperarMovimiento(page, descripcion, 20_000);
    saldosAntes = await saldos(page);
  });

  test('TRF-02 editar solo la descripción de una pata la guarda y deja los saldos intactos', async ({
    page,
    vigilancia,
  }) => {
    await abrirEdicionDeUnaPata(page, descripcion);
    const formulario = dialogo(page);
    await formulario.locator('input[name=description]').fill(editada);
    const marca = vigilancia.marca();
    await formulario.locator('button[type=submit]').click();
    await expect(formulario).toBeHidden();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /classification/).length).toBeGreaterThan(0);

    await page.reload();
    await ir(page, 'movements');
    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(editada);
    await buscador.press('Enter');
    await expect(page.locator('main table tbody tr').filter({ hasText: editada }).first()).toBeVisible();
    await expect.poll(async () => (await buscarMovimientos(page, editada)).length).toBeGreaterThan(0);
    expect(await saldos(page)).toEqual(saldosAntes);
  });

  test('TRF-03 cambiar el monto de una pata muestra el aviso y no guarda', async ({ page, vigilancia }) => {
    await abrirEdicionDeUnaPata(page, editada);
    const formulario = dialogo(page);
    const monto = formulario.locator('input[name=amount]');
    await expect(monto).toBeVisible();
    await monto.fill('99000');
    const marca = vigilancia.marca();
    await formulario.locator('button[type=submit]').click();
    await expect(formulario).toContainText(/solo permiten cambiar categoría y descripción/);
    await expect(formulario).toBeVisible();
    expect(vigilancia.exitosasDesde(marca, /movements/)).toHaveLength(0);
    await page.keyboard.press('Escape');
    const montos = (await buscarMovimientos(page, editada)).map((m) => Number(m.amount.original.amount));
    expect(montos.every((m) => m === 20_000)).toBeTruthy();
    expect(await saldos(page)).toEqual(saldosAntes);
  });
});
