import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { dialogo, elegirPendientes, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

test.describe.configure({ mode: 'serial' });

test.describe('Administración', () => {
  test('banderas: apagar y encender una bandera de la organización', async ({ page, vigilancia }) => {
    await ir(page, 'admin?tab=flags');
    await page.getByRole('textbox', { name: /Buscar funcionalidad/ }).fill('people.history');
    const global = page.getByRole('switch', { name: 'people.history · Global' });
    const organizacion = page.getByRole('switch', { name: /^people.history · (?!Global)/ });
    await expect(global).toBeVisible();
    const guardar = page.getByRole('button', { name: /^Guardar/ }).first();
    const alternar = async (interruptor: typeof global) => {
      const marca = vigilancia.marca();
      await interruptor.click();
      if (await guardar.isVisible().catch(() => false)) await guardar.click();
      await expect.poll(() => vigilancia.exitosasDesde(marca, /feature-flags/).length).toBeGreaterThan(0);
    };
    if ((await global.getAttribute('aria-checked')) !== 'true') await alternar(global);
    await expect(organizacion).toBeEnabled();
    const inicial = await organizacion.getAttribute('aria-checked');
    await alternar(organizacion);
    await expect(organizacion).not.toHaveAttribute('aria-checked', inicial ?? '');
    await alternar(organizacion);
    await expect(organizacion).toHaveAttribute('aria-checked', inicial ?? '');
  });

  test('organizaciones: crear una organización', async ({ page, vigilancia }) => {
    await ir(page, 'admin?tab=organizations');
    await page
      .getByRole('button', { name: /Crear organización|Nueva organización/i })
      .first()
      .click();
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre/)
      .first()
      .fill(`E2E Familia ${corrida}`);
    await elegirPendientes(formulario);
    const marca = vigilancia.marca();
    await formulario
      .locator('button[type=submit], button:has-text("Guardar"), button:has-text("Crear")')
      .last()
      .click();
    await expect(formulario).toBeHidden();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*organizations/).length).toBeGreaterThan(0);
  });

  test('roles: crear un rol', async ({ page, vigilancia }) => {
    await ir(page, 'admin?tab=roles');
    await page
      .getByRole('button', { name: /Crear rol/i })
      .first()
      .click();
    const formulario = dialogo(page);
    await formulario.getByLabel('Nombre').first().fill(`E2E Rol lector ${corrida}`);
    const marca = vigilancia.marca();
    await formulario
      .locator('button[type=submit], button:has-text("Crear"), button:has-text("Guardar")')
      .last()
      .click();
    await expect(formulario).toBeHidden();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*roles/).length).toBeGreaterThan(0);
  });
});
