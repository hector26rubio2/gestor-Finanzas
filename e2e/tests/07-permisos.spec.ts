import { apiUrl, credencialesLector, estadoLector } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { atajo, dialogo, ir } from '../support/ui';

test.skip(!credencialesLector(), 'Define E2E_VIEWER_USER y E2E_VIEWER_PASSWORD para probar la cuenta de solo lectura.');

test.use({ storageState: estadoLector });

test.describe('Cuenta de solo lectura (rol Beta)', () => {
  test('SES-06 no ofrece «Nuevo movimiento» ni abre formularios con atajos', async ({ page }) => {
    await ir(page, 'movements');
    await expect(page.getByRole('button', { name: /Nuevo movimiento/ })).toHaveCount(0);
    await atajo(page, 'n', 'g');
    await expect(dialogo(page)).toHaveCount(0);
  });

  test('SES-06 la navegación oculta las secciones sin permiso', async ({ page }) => {
    await ir(page, 'dashboard');
    const menu = page.locator('nav, [data-slot=sidebar]').first();
    await expect(menu).toContainText('Movimientos');
    await expect(menu).not.toContainText('Administración');
    await expect(menu).not.toContainText('Planificación');
  });

  test('NAV-02 una ruta sin permiso redirige al tablero', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('SES-06 el API rechaza la creación con 403', async ({ page, vigilancia }) => {
    await ir(page, 'dashboard');
    const respuesta = await page.request.post(`${apiUrl}/api/v1/accounts`, {
      data: { name: 'No debe existir', kind: 3, currency: 'COP' },
    });
    expect(respuesta.status()).toBe(403);
    vigilancia.aceptarErroresEsperados();
  });
});
