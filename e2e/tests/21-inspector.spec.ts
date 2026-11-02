import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { apiUrl } from '../support/entorno';
import { atajo, buscarMovimientos, esperarMovimiento, guardarMovimiento, ir, panelLateral } from '../support/ui';

const corrida = identificadorDeCorrida;

const LISTAS_COMPLETAS = /^\/api\/v1\/(accounts|cards|people|settlements|shared-purchases)(\?|$)/;

test.describe.configure({ mode: 'serial' });

test.describe('Inspector: acciones por comandos del dominio', () => {
  test('INS-01 revertir desde el inspector revierte en la API sin descargar listas completas', async ({
    page,
    vigilancia,
  }) => {
    const descripcion = `E2E inspector revertir ${corrida}`;
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    await guardarMovimiento(page, vigilancia, {
      monto: 21_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 21_000);

    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(descripcion);
    await buscador.press('Enter');
    const fila = page.locator('main table tbody tr').filter({ hasText: descripcion });
    await expect(fila).toHaveCount(1);
    await fila.getByRole('button', { name: /Ver detalle/ }).click();
    const detalle = panelLateral(page);
    await expect(detalle.getByRole('button', { name: 'Reversar', exact: true })).toBeVisible();

    const marcaDeEscrituras = vigilancia.marca();
    const marcaDeLecturas = vigilancia.marcaDeLecturas();
    await detalle.getByRole('button', { name: 'Reversar', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reversar movimiento' }).click();

    await expect.poll(() => vigilancia.exitosasDesde(marcaDeEscrituras, /POST .*reversal/).length).toBe(1);
    await expect.poll(async () => (await buscarMovimientos(page, descripcion)).some((m) => m.reversedBy)).toBe(true);
    await page.waitForLoadState('networkidle');
    expect(vigilancia.lecturasDesde(marcaDeLecturas).filter((ruta) => LISTAS_COMPLETAS.test(ruta))).toEqual([]);
  });

  test('INS-02 liquidar desde el inspector de una persona emite la liquidación sin descargar listas completas', async ({
    page,
    vigilancia,
  }) => {
    await ir(page, 'people');
    const tabla = page.getByRole('region', { name: 'Personas y deudas' });
    await tabla.getByText(nombres.persona, { exact: true }).first().click();
    const detalle = panelLateral(page);
    const liquidar = detalle.getByRole('button', { name: 'Generar liquidación' });
    await expect(liquidar).toBeVisible();
    await page.waitForLoadState('networkidle');

    const marcaDeEscrituras = vigilancia.marca();
    const marcaDeLecturas = vigilancia.marcaDeLecturas();
    await liquidar.click();

    await expect.poll(() => vigilancia.exitosasDesde(marcaDeEscrituras, /POST .*settlements/).length).toBe(1);
    const respuesta = await page.request.get(`${apiUrl}/api/v1/settlements`);
    expect(respuesta.ok()).toBeTruthy();
    const cuerpo = (await respuesta.json()) as
      { counterparty: { name: string } }[] | { items: { counterparty: { name: string } }[] };
    const liquidaciones = Array.isArray(cuerpo) ? cuerpo : cuerpo.items;
    expect(liquidaciones.some((l) => l.counterparty.name === nombres.persona)).toBe(true);
    await page.waitForLoadState('networkidle');
    expect(vigilancia.lecturasDesde(marcaDeLecturas).filter((ruta) => LISTAS_COMPLETAS.test(ruta))).toEqual([]);
  });
});
