import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, buscarMovimientos, dialogo, esperarMovimiento, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

test.describe.configure({ mode: 'serial' });

test.describe('Separador de miles en el monto', () => {
  test('MIL-01 el monto muestra el separador al escribir y se guarda exacto', async ({ page, vigilancia }) => {
    const descripcion = `E2E separador de miles ${corrida}`;
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    const monto = dialogo(page).locator('input[name=amount]');
    await monto.click();
    await monto.pressSequentially('1500000');
    await expect(monto).toHaveValue('1.500.000');

    await guardarMovimiento(page, vigilancia, {
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await esperarMovimiento(page, descripcion, 1_500_000);

    await page.reload();
    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(descripcion);
    await buscador.press('Enter');
    const fila = page.locator('main table tbody tr').filter({ hasText: descripcion });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('1.500.000');

    const guardados = await buscarMovimientos(page, descripcion);
    expect(guardados.map((m) => m.amount.original.amount)).toEqual(['1500000']);
  });
});
