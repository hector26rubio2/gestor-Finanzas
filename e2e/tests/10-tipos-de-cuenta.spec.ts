import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { atajo, dialogo, elegir, guardarDialogo, ir } from '../support/ui';

const tipos = [
  { etiqueta: 'Ahorros', kind: 3 },
  { etiqueta: 'Cuenta corriente', kind: 2 },
  { etiqueta: 'Efectivo', kind: 1 },
  { etiqueta: 'Billetera digital', kind: 4 },
  { etiqueta: 'Otra', kind: 99 },
] as const;

test.describe('Tipo de cuenta', () => {
  for (const tipo of tipos) {
    test(`CTA-10 una cuenta «${tipo.etiqueta}» se guarda y se lista con ese tipo`, async ({ page, vigilancia }) => {
      const nombre = `E2E Tipo ${tipo.kind} ${identificadorDeCorrida}`;
      await ir(page, 'accounts');
      await atajo(page, 'n', 'c');
      const formulario = dialogo(page);
      await elegir(formulario, 'Tipo de cuenta', new RegExp(`^\\s*${tipo.etiqueta}\\s*$`));
      await formulario.locator('input[name="cuenta.name"]').fill(nombre);
      await formulario.locator('input[name="cuenta.opening"]').fill('1000');
      await guardarDialogo(page, vigilancia, /POST .*accounts/);
      await expect(formulario).toBeHidden();

      const cuentas = (await (await page.request.get(`${apiUrl}/api/v1/accounts`)).json()) as {
        name: string;
        kind: number;
      }[];
      expect(cuentas.find((c) => c.name === nombre)?.kind, 'kind guardado en la API').toBe(tipo.kind);

      await page.reload({ waitUntil: 'domcontentloaded' });
      const pagina = page.locator('main');
      await pagina.getByPlaceholder('Nombre o terminación').fill(nombre);
      await elegir(pagina, 'Tipo de cuenta', new RegExp(`^\\s*${tipo.etiqueta}\\s*$`));
      const chip = pagina.getByRole('button', { name: nombre, exact: true });
      await expect(chip, 'la cuenta aparece al filtrar por su tipo').toBeVisible();
      await chip.click();
      await expect(
        pagina.locator(`section[aria-label="${nombre}"]`),
        'etiqueta de tipo de la cuenta seleccionada',
      ).toContainText(tipo.etiqueta);
    });
  }
});
