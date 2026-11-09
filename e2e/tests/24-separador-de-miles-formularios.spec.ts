import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, dialogo, guardarDialogo, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

test.describe.configure({ mode: 'serial' });

interface SaldosApi {
  balances: { accounts: { account: { id: string }; balance: { amount: string } }[] };
}

test.describe('Separador de miles en los demás formularios', () => {
  test('MIL-02 el saldo inicial de una cuenta muestra el separador y se guarda exacto', async ({
    page,
    vigilancia,
  }) => {
    const nombre = `E2E Saldo grande ${corrida}`;
    await ir(page, 'accounts');
    await atajo(page, 'n', 'c');
    const formulario = dialogo(page);
    await formulario.locator('input[name="cuenta.name"]').fill(nombre);
    const saldo = formulario.locator('input[name="cuenta.opening"]');
    await saldo.click();
    await saldo.pressSequentially('25000000');
    await expect(saldo).toHaveValue('25.000.000');
    await guardarDialogo(page, vigilancia, /POST .*accounts/);
    await expect(formulario).toBeHidden();

    await page.reload();
    const cuentas = (await (await page.request.get(`${apiUrl}/api/v1/accounts`)).json()) as {
      id: string;
      name: string;
    }[];
    const cuenta = cuentas.find((c) => c.name === nombre)!;
    expect(cuenta, 'la cuenta existe en la API').toBeTruthy();
    await expect
      .poll(async () => {
        const arranque = (await (await page.request.get(`${apiUrl}/api/v1/bootstrap`)).json()) as SaldosApi;
        const saldoApi = arranque.balances.accounts.find((s) => s.account.id === cuenta.id);
        return saldoApi ? Number(saldoApi.balance.amount) : null;
      })
      .toBe(25_000_000);
  });

  test('MIL-03 el límite de un presupuesto muestra el separador y se guarda exacto', async ({
    page,
    vigilancia,
    semilla,
  }) => {
    await ir(page, 'settings?section=budgets');
    const fila = page.locator(`li[data-categoria="${nombres.restaurantes}"]`);
    await fila.getByRole('button').first().click();
    const limite = fila.locator('input[data-slot=limite]');
    await limite.click();
    await limite.pressSequentially('3500000');
    await expect(limite).toHaveValue('3.500.000');

    const marca = vigilancia.marca();
    await fila.locator('button[type=submit]').click();
    await expect
      .poll(() => vigilancia.exitosasDesde(marca, /PUT .*budgets/).length, { message: 'sin PUT de presupuesto' })
      .toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator(`li[data-categoria="${nombres.restaurantes}"]`)).toContainText('3.500.000');
    const lectura = await page.request.get(`${apiUrl}/api/v1/budgets`);
    const presupuestos = (await lectura.json()) as { category: { id: string }; monthlyLimit: { amount: string } }[];
    const guardado = presupuestos.find((p) => p.category.id === semilla.catalogos.restaurantes);
    expect(Number(guardado?.monthlyLimit.amount)).toBe(3_500_000);
  });
});
