import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, guardarMovimiento, ir, panelLateral } from '../support/ui';

const OBLIGACIONES = /^\/api\/v1\/obligations(\?|$)/;
const POSICIONES = /^\/api\/v1\/people\/debt-positions(\?|$)/;

test.describe('Una sola recarga al liquidar', () => {
  test('REC-01 liquidar a una persona pide una vez cada lista afectada y el saldo queda correcto', async ({
    page,
    vigilancia,
  }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 'l');
    await guardarMovimiento(page, vigilancia, {
      monto: 33_000,
      descripcion: `E2E recarga deuda ${identificadorDeCorrida}`,
      selecciones: { '¿A quién le prestaste?:': nombres.persona },
    });

    await ir(page, 'people');
    const tabla = page.getByRole('region', { name: 'Personas y deudas' });
    const fila = tabla.getByRole('row').filter({ hasText: nombres.persona }).first();
    await page.waitForLoadState('networkidle');
    const saldoAntes = await fila.innerText();
    await tabla.getByText(nombres.persona, { exact: true }).first().click();
    const detalle = panelLateral(page);
    const liquidar = detalle.getByRole('button', { name: 'Generar liquidación' });
    await expect(liquidar).toBeVisible();
    await page.waitForLoadState('networkidle');

    const marcaDeEscrituras = vigilancia.marca();
    const marcaDeLecturas = vigilancia.marcaDeLecturas();
    await liquidar.click();
    await expect.poll(() => vigilancia.exitosasDesde(marcaDeEscrituras, /POST .*settlements/).length).toBe(1);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');

    const lecturas = vigilancia.lecturasDesde(marcaDeLecturas);
    expect(lecturas.filter((ruta) => OBLIGACIONES.test(ruta))).toHaveLength(1);
    expect(lecturas.filter((ruta) => POSICIONES.test(ruta)).length).toBeLessThanOrEqual(1);

    await page.reload();
    const tablaNueva = page.getByRole('region', { name: 'Personas y deudas' });
    await expect(tablaNueva.getByRole('row').filter({ hasText: nombres.persona }).first()).toHaveText(saldoAntes);
  });
});
