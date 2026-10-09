import { credencialesPropietario } from '../support/entorno';
import { expect, test } from '../support/fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({ vigilancia }) => vigilancia.permitirSinSesion());

async function escribirCredenciales(page: import('@playwright/test').Page, usuario: string, clave: string) {
  await page.goto('/login');
  const campoUsuario = page.locator('input:not([type=password]):not([type=hidden])').first();
  await expect(campoUsuario).toBeVisible();
  await campoUsuario.fill(usuario);
  await page.locator('input[type=password]').fill(clave);
  await page.locator('button[type=submit]').click();
}

test.describe('Sesión', () => {
  test('SES-01 login con usuario y contraseña válidos lleva al tablero', async ({ page, vigilancia }) => {
    const { usuario, clave } = credencialesPropietario();
    await escribirCredenciales(page, usuario, clave);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('SES-02 contraseña inválida muestra el error y no abre sesión', async ({ page, vigilancia }) => {
    const { usuario } = credencialesPropietario();
    await escribirCredenciales(page, usuario, 'clave-incorrecta-e2e');
    await expect(page.locator('[role=alert]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(vigilancia.escrituras.map((e) => e.estado)).toContain(401);
    vigilancia.aceptarErroresEsperados();
  });

  test('SES-08 sin sesión una ruta protegida redirige al login', async ({ page, vigilancia }) => {
    await page.goto('/movements');
    await expect(page).toHaveURL(/\/login/);
  });

  test('SES-14 cerrar sesión vuelve al login y exige autenticarse otra vez', async ({ page, vigilancia }) => {
    const { usuario, clave } = credencialesPropietario();
    await escribirCredenciales(page, usuario, clave);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.locator('[data-slot=profile-trigger]').click();
    await page.getByRole('menuitem', { name: /Cerrar sesión|Salir/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/movements');
    await expect(page).toHaveURL(/\/login/);
  });
});
