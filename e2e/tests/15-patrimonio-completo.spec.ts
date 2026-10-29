import type { Page } from '@playwright/test';
import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { dialogo, elegir, guardarDialogo, ir, panelLateral } from '../support/ui';

interface InversionApi {
  id: string;
  name: string;
  costBasis: { amount: string };
  marketValue: { amount: string } | null;
  unrealizedGain: { amount: string } | null;
  netContributions: { amount: string };
}

interface CuentaApi {
  id: string;
  name: string;
}

async function leer<T>(page: Page, ruta: string): Promise<T> {
  const respuesta = await page.request.get(`${apiUrl}${ruta}`);
  expect(respuesta.ok(), `${ruta}: ${respuesta.status()}`).toBeTruthy();
  return (await respuesta.json()) as T;
}

test.describe('Patrimonio completo', () => {
  test('PAT-01 crear inversión, registrar aporte y valorización mayor refleja ganancia', async ({
    page,
    vigilancia,
    semilla,
  }) => {
    const nombre = `E2E Fondo ${identificadorDeCorrida}`;
    await ir(page, 'portfolio');
    await page.getByRole('button', { name: 'Inversión', exact: true }).click();
    const alta = dialogo(page);
    await alta.getByLabel('Nombre', { exact: true }).fill(nombre);
    await alta.locator('input[name="gestion.symbol"]').fill('E2EF');
    await guardarDialogo(page, vigilancia, /POST .*investments/);
    await expect(alta).toBeHidden();

    const cuentas = await leer<CuentaApi[]>(page, '/api/v1/accounts');
    const cuenta = cuentas.find((c) => c.id === semilla.cuentas.ahorros)!;

    await page
      .getByPlaceholder(/Buscar/)
      .first()
      .fill(nombre);
    await page.getByRole('button', { name: `Ver detalle: ${nombre}`, exact: true }).click();
    const detalle = panelLateral(page);
    await expect(detalle.getByText('Sin valorización').first()).toBeVisible();

    await detalle.getByRole('button', { name: 'Registrar operación' }).click();
    const operacion = dialogo(page);
    await operacion.locator('input[name="operacion.amount"]').fill('500000');
    await elegir(operacion, 'Cuenta', cuenta.name);
    await guardarDialogo(page, vigilancia, /POST .*investments\/.*operations/);
    await expect(operacion).toBeHidden();

    const inversion = async () =>
      (await leer<InversionApi[]>(page, '/api/v1/investments')).find((i) => i.name === nombre)!;
    await expect.poll(async () => Number((await inversion()).netContributions.amount)).toBe(500000);

    await detalle.getByRole('button', { name: 'Registrar valorización' }).click();
    const valorizacion = dialogo(page);
    await valorizacion.locator('input[name="valorizacion.value"]').fill('600000');
    await guardarDialogo(page, vigilancia, /POST .*investments\/.*valuations/);
    await expect(valorizacion).toBeHidden();

    await expect.poll(async () => Number((await inversion()).marketValue?.amount ?? 0)).toBe(600000);
    expect(Number((await inversion()).unrealizedGain?.amount ?? 0)).toBe(100000);

    await expect(detalle.getByText('Última valorización')).toBeVisible();
    await expect(detalle.getByText('Sin valorización')).toHaveCount(0);
    await detalle.getByRole('button', { name: 'Cerrar' }).first().click();

    const fila = page.getByRole('row').filter({ hasText: nombre });
    await expect(fila).toContainText('600.000');
    await expect(fila).not.toContainText('*');
    await expect(page.locator('main')).toContainText('Ganancia no realizada');
  });
});
