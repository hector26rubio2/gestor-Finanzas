import type { Page } from '@playwright/test';
import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import {
  atajo,
  buscarMovimientos,
  dialogo,
  esperarMovimiento,
  guardarMovimiento,
  ir,
  panelLateral,
} from '../support/ui';

const corrida = identificadorDeCorrida;

test.describe.configure({ mode: 'serial' });

test.describe('Movimientos: alta por atajo', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('MOV-01 gasto con categoría (n g)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'g');
    const descripcion = `E2E gasto mercado ${corrida}`;
    await guardarMovimiento(page, vigilancia, {
      monto: 45_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 45_000);
  });

  test('MOV-03 compra con tarjeta de crédito (n g)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'g');
    const descripcion = `E2E compra tarjeta ${corrida}`;
    await guardarMovimiento(page, vigilancia, {
      monto: 150_000,
      descripcion,
      selecciones: { 'Cuenta o tarjeta:': nombres.tarjeta, 'Categoría:': nombres.restaurantes },
    });
    await esperarMovimiento(page, descripcion, 150_000);
    const [compra] = await buscarMovimientos(page, descripcion);
    expect(compra.kind).toBe(20);
  });

  test('MOV-02 ingreso (n i)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'i');
    const descripcion = `E2E ingreso freelance ${corrida}`;
    await guardarMovimiento(page, vigilancia, {
      monto: 120_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.salario },
    });
    await esperarMovimiento(page, descripcion, 120_000);
  });

  test('MOV-06 transferencia entre cuentas de la misma moneda (n t)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 't');
    const descripcion = `E2E transferencia ${corrida}`;
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 30_000,
      descripcion,
      selecciones: { 'Cuenta destino:': nombres.corriente },
    });
    expect(resumen).toMatch(/transfers/);
    await esperarMovimiento(page, descripcion, 30_000);
  });

  test('MOV-07 la transferencia solo ofrece cuentas de la misma moneda', async ({ page }) => {
    await atajo(page, 'n', 't');
    const formulario = dialogo(page);
    await formulario.locator('[data-slot=select-trigger][aria-label^="Cuenta destino"]').click();
    await expect(page.locator('[role=option]').first()).toBeVisible();
    await expect(page.locator('[role=option]').filter({ hasText: nombres.dolares })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('MOV-08 transferencia recibida de un tercero (n r)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'r');
    const descripcion = `E2E recibida ${corrida}`;
    await guardarMovimiento(page, vigilancia, {
      monto: 25_000,
      descripcion,
      selecciones: { '¿Quién te transfirió?:': nombres.persona, 'Categoría:': nombres.salario },
    });
    await esperarMovimiento(page, descripcion, 25_000);
  });

  test('MOV-09 avance de tarjeta (n a)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'a');
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 200_000,
      descripcion: `E2E avance ${corrida}`,
      selecciones: { 'Tarjeta del avance:': nombres.tarjeta, 'Cuenta donde entra el efectivo:': nombres.corriente },
    });
    expect(resumen).toMatch(/cash-advances/);
  });

  test('MOV-11 prestar dinero a una persona (n l)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'l');
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 50_000,
      descripcion: `E2E préstamo dado ${corrida}`,
      selecciones: { '¿A quién le prestaste?:': nombres.persona },
    });
    expect(resumen).toMatch(/loans/);
  });

  test('MOV-11 préstamo recibido de una persona (n b)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'b');
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 80_000,
      descripcion: `E2E préstamo recibido ${corrida}`,
      selecciones: { '¿Quién te prestó?:': nombres.persona },
    });
    expect(resumen).toMatch(/loans/);
  });

  test('MOV-11 crédito de una entidad (n k)', async ({ page, vigilancia }) => {
    await atajo(page, 'n', 'k');
    const resumen = await guardarMovimiento(page, vigilancia, {
      monto: 1_000_000,
      descripcion: `E2E crédito ${corrida}`,
      selecciones: { 'Entidad que otorga el crédito:': nombres.entidad },
    });
    expect(resumen).toMatch(/loans/);
  });
});

test.describe('Movimientos: pago de tarjeta', () => {
  test('MOV-10 pagar la tarjeta desde una cuenta (n p)', async ({ page, vigilancia }) => {
    await ir(page, 'accounts');
    await atajo(page, 'n', 'p');
    const panel = panelLateral(page);
    await expect(panel.getByText(/Valor del abono/)).toBeVisible();
    await panel.locator('input[type=number]').first().fill('40000');
    const marca = vigilancia.marca();
    await panel.getByRole('button', { name: /Confirmar abono/ }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /card-payments/).length).toBeGreaterThan(0);
  });
});

async function abrirDetalleDe(page: Page, descripcion: string): Promise<void> {
  const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
  await buscador.fill(descripcion);
  await buscador.press('Enter');
  const fila = page.locator('main table tbody tr').filter({ hasText: descripcion });
  await expect(fila).toHaveCount(1);
  await fila.getByRole('button', { name: /Ver detalle/ }).click();
}

test.describe('Movimientos: libro', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('MOV-16 la búsqueda de texto filtra en el servidor', async ({ page }) => {
    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(`E2E gasto mercado ${corrida}`);
    await buscador.press('Enter');
    const filas = page.locator('main table tbody tr');
    await expect(filas.filter({ hasText: `E2E gasto mercado ${corrida}` })).toHaveCount(1);
  });

  test('MOV-17 la paginación avanza a otra página', async ({ page }) => {
    const filas = page.locator('main table tbody tr');
    await expect(filas.first()).toBeVisible();
    const antes = await filas.first().innerText();
    await page
      .getByRole('button', { name: /Página siguiente|siguiente/i })
      .first()
      .click();
    await expect.poll(async () => filas.first().innerText()).not.toBe(antes);
  });

  test('MOV-18 exportar CSV descarga un archivo', async ({ page }) => {
    const descarga = page.waitForEvent('download');
    await page
      .getByRole('button', { name: /Exportar CSV/i })
      .first()
      .click();
    expect((await descarga).suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('MOV-12 reclasificar desde el detalle', async ({ page, vigilancia }) => {
    await abrirDetalleDe(page, `E2E gasto mercado ${corrida}`);
    await page
      .getByRole('button', { name: /Reclasificar|Editar/ })
      .first()
      .click();
    const formulario = dialogo(page);
    await expect(formulario).toBeVisible();
    await formulario.locator('input[name=description], input[type=text]').first().fill(`E2E reclasificado ${corrida}`);
    const marca = vigilancia.marca();
    await formulario.locator('button[type=submit], button:has-text("Guardar")').last().click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /classification/).length).toBeGreaterThan(0);
  });

  test('MOV-13 reversar desde el detalle', async ({ page, vigilancia }) => {
    await abrirDetalleDe(page, `E2E ingreso freelance ${corrida}`);
    const reversar = page.getByRole('button', { name: /Revers|Anular/i }).first();
    await expect(reversar).toBeVisible();
    const marca = vigilancia.marca();
    await reversar.click();
    const confirmar = page.getByRole('button', { name: /Confirmar|Revers|Sí/i }).last();
    if (await confirmar.isVisible().catch(() => false)) await confirmar.click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /reversal/).length).toBeGreaterThan(0);
  });
});
