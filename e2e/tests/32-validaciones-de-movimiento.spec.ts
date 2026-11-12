import type { Locator, Page } from '@playwright/test';
import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test, type Vigilancia } from '../support/fixtures';
import { nombres } from '../support/semilla';
import {
  atajo,
  buscarMovimientos,
  dialogo,
  elegir,
  elegirPendientes,
  esperarMovimiento,
  guardarMovimiento,
  ir,
} from '../support/ui';

const corrida = identificadorDeCorrida;
const MS_POR_DIA = 86_400_000;

const fechaUtcEnDias = (dias: number) => new Date(Date.now() + dias * MS_POR_DIA).toISOString().slice(0, 10);

async function abrirGasto(page: Page): Promise<Locator> {
  await ir(page, 'movements');
  await atajo(page, 'n', 'g');
  const formulario = dialogo(page);
  await formulario.waitFor({ state: 'visible' });
  return formulario;
}

async function prepararGasto(formulario: Locator, descripcion: string, monto: number): Promise<void> {
  await formulario.locator('input[name=amount]').fill(String(monto));
  await elegir(formulario, 'Categoría:', nombres.mercado);
  await elegirPendientes(formulario);
  await formulario.locator('input[name=description]').fill(descripcion);
}

async function guardarYVerAviso(
  page: Page,
  vigilancia: Vigilancia,
  formulario: Locator,
  mensaje: string,
  descripcion: string,
): Promise<void> {
  const marca = vigilancia.marca();
  await formulario.locator('button[type=submit]').click();
  await expect(formulario.getByRole('alert').filter({ hasText: mensaje })).toBeVisible();
  await expect(formulario).toBeVisible();
  await expect(page.getByText(mensaje)).toHaveCount(1);
  expect(vigilancia.escriturasDesde(marca), 'no debe haber escrituras').toEqual([]);
  await page.reload();
  expect(await buscarMovimientos(page, descripcion), 'el movimiento no debe existir tras recargar').toEqual([]);
}

test.describe('Validaciones del formulario de movimiento', () => {
  test('VAL-01 monto 0 avisa, no guarda y deja el formulario abierto', async ({ page, vigilancia }) => {
    const descripcion = `E2E monto cero ${corrida}`;
    const formulario = await abrirGasto(page);
    await prepararGasto(formulario, descripcion, 0);

    await guardarYVerAviso(page, vigilancia, formulario, 'El monto debe ser mayor a 0.', descripcion);
  });

  test('VAL-02 sin cuenta avisa, no guarda y deja el formulario abierto', async ({ page, vigilancia }) => {
    const descripcion = `E2E sin cuenta ${corrida}`;
    const formulario = await abrirGasto(page);
    await prepararGasto(formulario, descripcion, 15_000);
    await elegir(formulario, 'Cuenta o tarjeta:', /^Selecciona/);

    await guardarYVerAviso(page, vigilancia, formulario, 'Selecciona una cuenta válida.', descripcion);
  });

  test('VAL-03 el selector de fecha no deja elegir después de hoy', async ({ page }) => {
    const formulario = await abrirGasto(page);
    await formulario.getByRole('button', { name: 'Fecha' }).click();

    const hoy = new Date();
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    if (manana.getMonth() !== hoy.getMonth()) await page.getByRole('button', { name: /next month/i }).click();

    const celdaDeHoy = page.getByRole('gridcell', { name: String(hoy.getDate()), exact: true }).first();
    const celdaDeManana = page.getByRole('gridcell', { name: String(manana.getDate()), exact: true }).first();
    await expect(celdaDeManana).toBeDisabled();
    if (manana.getMonth() === hoy.getMonth()) await expect(celdaDeHoy).toBeEnabled();
  });

  test('VAL-04 dólares con monto original 0 avisa del monto en dólares', async ({ page, vigilancia }) => {
    const descripcion = `E2E dolares cero ${corrida}`;
    const formulario = await abrirGasto(page);
    await formulario.locator('input[name=description]').fill(descripcion);
    await elegir(formulario, 'Categoría:', nombres.mercado);
    await elegir(formulario, 'Cuenta o tarjeta:', nombres.dolares);
    await formulario.locator('input[name=originalAmount]').fill('0');
    await formulario.locator('input[name=exchangeRate]').fill('4100');
    await elegirPendientes(formulario);

    await guardarYVerAviso(page, vigilancia, formulario, 'El monto en dólares debe ser mayor a 0.', descripcion);
  });

  test('VAL-05 con datos válidos de hoy el movimiento se guarda', async ({ page, vigilancia }) => {
    const descripcion = `E2E fecha de hoy ${corrida}`;
    const formulario = await abrirGasto(page);
    await guardarMovimiento(page, vigilancia, {
      monto: 18_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 18_000);
    await expect(formulario).toBeHidden();
  });

  test('VAL-06 la API rechaza una fecha de pasado mañana con movement.date_in_future', async ({ page, semilla }) => {
    await ir(page, 'movements');
    const { token } = (await (await page.request.get(`${apiUrl}/api/v1/auth/csrf`)).json()) as { token: string };
    const descripcion = `E2E fecha futura api ${corrida}`;

    const respuesta = await page.request.post(`${apiUrl}/api/v1/movements`, {
      headers: { 'X-CSRF-Token': token },
      data: {
        date: fechaUtcEnDias(2),
        kind: 2,
        effect: 2,
        flow: 2,
        amount: { amount: '12000', currency: 'COP' },
        links: { account: semilla.cuentas.efectivo },
        description: descripcion,
      },
    });

    expect(respuesta.status()).toBe(400);
    expect(((await respuesta.json()) as { code: string }).code).toBe('movement.date_in_future');
    expect(await buscarMovimientos(page, descripcion)).toEqual([]);
  });
});
