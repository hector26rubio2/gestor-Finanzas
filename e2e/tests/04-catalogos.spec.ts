import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { abrirPaleta, atajo, dialogo, elegirPendientes, guardarDialogo, ir, llenarNumerosVacios } from '../support/ui';

const corrida = identificadorDeCorrida;

test.describe.configure({ mode: 'serial' });

test.describe('Catálogos y registros', () => {
  test('CTA-01 crear una cuenta con saldo inicial (n c)', async ({ page, vigilancia }) => {
    await ir(page, 'accounts');
    await atajo(page, 'n', 'c');
    const formulario = dialogo(page);
    await formulario.locator('input[name=name]').fill(`E2E Cuenta nómina ${corrida}`);
    await formulario.locator('input[name=opening]').fill('500000');
    await guardarDialogo(page, vigilancia, /POST .*accounts/);
    await expect(formulario).toBeHidden();
    const respuesta = await page.request.get(`${apiUrl}/api/v1/accounts`);
    const cuentas = (await respuesta.json()) as { name: string }[];
    expect(cuentas.map((c) => c.name)).toContain(`E2E Cuenta nómina ${corrida}`);
  });

  test('CTA-07 crear una categoría desde la paleta', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await abrirPaleta(page, 'Nueva categoría');
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre/)
      .first()
      .fill(`E2E Mascotas ${corrida}`);
    await elegirPendientes(formulario);
    await guardarDialogo(page, vigilancia, /POST .*categories/);
  });

  test('personas: crear una persona desde la paleta', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await abrirPaleta(page, 'Nueva persona');
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre/)
      .first()
      .fill(`E2E Carlos ${corrida}`);
    await elegirPendientes(formulario);
    await guardarDialogo(page, vigilancia, /POST .*people/);
  });

  test('patrimonio: crear una inversión desde la paleta', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await abrirPaleta(page, 'Nueva inversión');
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre/)
      .first()
      .fill(`E2E CDT 90 días ${corrida}`);
    await llenarNumerosVacios(formulario, '1000000');
    await elegirPendientes(formulario);
    await guardarDialogo(page, vigilancia, /POST .*investments/);
  });

  test('CAL-05 crear un gasto recurrente desde la paleta', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await abrirPaleta(page, 'Nuevo gasto recurrente');
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre|Descripción/)
      .first()
      .fill(`E2E Netflix ${corrida}`);
    await llenarNumerosVacios(formulario, '45000');
    await elegirPendientes(formulario);
    await guardarDialogo(page, vigilancia, /POST .*recurrences/);
  });

  test('CAL-06 confirmar una ocurrencia recurrente del calendario', async ({ page, vigilancia }) => {
    await ir(page, 'calendar');
    const ocurrencia = page
      .locator('[data-slot=agenda-item]')
      .filter({ hasText: `E2E Netflix ${corrida}` })
      .first();
    await expect(ocurrencia).toBeVisible();
    const marca = vigilancia.marca();
    await ocurrencia.click();
    await expect.poll(() => vigilancia.exitosasDesde(marca).length).toBeGreaterThan(0);
  });

  test('presupuestos: fijar y leer el límite mensual de una categoría (API)', async ({ page, semilla }) => {
    const categoria = semilla.catalogos.mercado;
    const alta = await page.request.put(`${apiUrl}/api/v1/budgets/${categoria}`, {
      data: { monthlyLimit: { amount: '800000', currency: 'COP' } },
    });
    expect(alta.status()).toBe(200);
    const lectura = await page.request.get(`${apiUrl}/api/v1/budgets`);
    const presupuestos = (await lectura.json()) as { category: { id: string }; monthlyLimit: { amount: string } }[];
    const fijado = presupuestos.find((p) => p.category.id === categoria);
    expect(Number(fijado?.monthlyLimit.amount)).toBe(800_000);
  });
});
