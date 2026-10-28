import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { atajo, buscarMovimientos, ir, panelLateral } from '../support/ui';

test.describe('Abono de tarjeta', () => {
  test('ABO-01 un abono mayor que la deuda se registra completo, con motivo y aviso de saldo a favor', async ({
    page,
    vigilancia,
  }) => {
    const motivo = `E2E abono motivo ${identificadorDeCorrida}`;
    await ir(page, 'accounts');
    await atajo(page, 'n', 'p');
    const panel = panelLateral(page);
    await expect(panel.getByText(/Valor del abono/)).toBeVisible();
    await panel.locator('input[type=number]').first().fill('900000000');
    await panel.getByLabel(/Motivo/).fill(motivo);
    await expect(panel.getByText(/a favor/)).toBeVisible();
    const marca = vigilancia.marca();
    await panel.getByRole('button', { name: /Confirmar abono/ }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /card-payments/).length).toBeGreaterThan(0);
    await expect
      .poll(async () => (await buscarMovimientos(page, motivo)).map((m) => Number(m.amount.original.amount)))
      .toContain(900_000_000);
  });
});
