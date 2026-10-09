import { expect, test } from '../support/fixtures';
import { atajo, dialogo, enfocarContenido, ir } from '../support/ui';

const secciones: [string, string][] = [
  ['d', 'dashboard'],
  ['m', 'movements'],
  ['c', 'calendar'],
  ['a', 'accounts'],
  ['p', 'people'],
  ['i', 'portfolio'],
  ['l', 'planning'],
  ['r', 'reports'],
  ['n', 'notifications'],
  ['x', 'admin'],
  ['s', 'settings'],
];

test.describe('Navegación y atajos', () => {
  for (const [tecla, ruta] of secciones) {
    test(`NAV-05 atajo g ${tecla} abre ${ruta}`, async ({ page }) => {
      await ir(page, ruta === 'dashboard' ? 'settings' : 'dashboard');
      await atajo(page, 'g', tecla);
      await expect(page).toHaveURL(new RegExp(`/${ruta}([?]|$)`));
    });
  }

  test('NAV-05 los atajos se ignoran mientras se escribe en un campo', async ({ page }) => {
    await ir(page, 'movements');
    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.click();
    await page.keyboard.type('g c');
    await expect(page).toHaveURL(/\/movements/);
    await expect(buscador).toHaveValue('g c');
  });

  test('NAV-04 Ctrl+K abre la paleta, filtra y navega con Enter', async ({ page }) => {
    await ir(page, 'dashboard');
    await page.keyboard.press('Control+k');
    const entrada = dialogo(page).locator('input').first();
    await expect(entrada).toBeFocused();
    await entrada.fill('reportes');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/reports/);
  });

  test('NAV-04 la paleta se cierra con Escape y se abre con /', async ({ page }) => {
    await ir(page, 'dashboard');
    await enfocarContenido(page);
    await page.keyboard.press('/');
    await expect(dialogo(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo(page)).toBeHidden();
  });

  test('NAV-06 la paleta ejecuta «nuevo gasto» y abre el formulario', async ({ page }) => {
    await ir(page, 'dashboard');
    await page.keyboard.press('Control+k');
    const entrada = dialogo(page).locator('input').first();
    await expect(entrada).toBeFocused();
    await entrada.fill('gasto');
    await page.locator('[data-slot=command-item]').first().click();
    await expect(dialogo(page).locator('input[name=amount]')).toBeVisible();
  });

  test('NAV-09 el botón «Nuevo movimiento» del encabezado abre el formulario', async ({ page }) => {
    await ir(page, 'movements');
    await page
      .getByRole('button', { name: /Nuevo movimiento/ })
      .first()
      .click();
    await expect(dialogo(page).getByRole('tab', { name: 'Gasto' })).toBeVisible();
    await dialogo(page).getByRole('tab', { name: 'Gasto' }).click();
    await expect(dialogo(page).locator('input[name=amount]')).toBeVisible();
  });
});
