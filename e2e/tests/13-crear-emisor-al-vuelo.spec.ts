import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { atajo, dialogo, guardarDialogo, ir } from '../support/ui';

test.describe('Entidad emisora', () => {
  test('CTA-11 se elige o se crea la entidad desde el formulario de cuenta', async ({ page, vigilancia }) => {
    const banco = `E2E Banco ${identificadorDeCorrida}`;
    const cuenta = `E2E Cuenta con banco ${identificadorDeCorrida}`;
    await ir(page, 'accounts');
    await atajo(page, 'n', 'c');
    const formulario = dialogo(page);
    const nombre = formulario.locator('input[name="cuenta.name"]');
    await expect(nombre).toHaveValue('');

    const entidad = formulario.getByRole('combobox', { name: /Entidad emisora/ });
    await entidad.fill(banco);
    const marca = vigilancia.marca();
    await page.getByRole('option', { name: `Crear «${banco}»` }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*people/).length).toBeGreaterThan(0);
    await expect(entidad).toHaveValue(banco);

    await nombre.fill(cuenta);
    await guardarDialogo(page, vigilancia, /POST .*accounts/);

    const personas = (await (await page.request.get(`${apiUrl}/api/v1/people`)).json()) as {
      id: string;
      displayName: string;
    }[];
    const creado = personas.find((p) => p.displayName === banco);
    expect(creado, 'la entidad existe').toBeTruthy();
    const cuentas = (await (await page.request.get(`${apiUrl}/api/v1/accounts`)).json()) as {
      name: string;
      issuerEntity?: { id: string } | null;
    }[];
    expect(cuentas.find((c) => c.name === cuenta)?.issuerEntity?.id, 'la cuenta quedó con ese emisor').toBe(creado!.id);
  });
});
