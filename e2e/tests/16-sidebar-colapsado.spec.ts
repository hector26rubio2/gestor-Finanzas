import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { ir } from '../support/ui';

const enlaces = (page: Page) => page.locator('nav#primary-navigation a[href]');

async function destinos(page: Page): Promise<string[]> {
  const rutas: string[] = [];
  const total = await enlaces(page).count();
  for (let i = 0; i < total; i++) {
    const enlace = enlaces(page).nth(i);
    if (await enlace.isVisible()) rutas.push((await enlace.getAttribute('href')) ?? '');
  }
  return rutas;
}

async function recorrer(page: Page) {
  const rutas = await destinos(page);
  expect(rutas.length).toBeGreaterThan(3);
  for (const ruta of rutas) {
    await page.locator(`nav#primary-navigation a[href="${ruta}"]`).first().click();
    await expect(page).toHaveURL((url) => url.pathname === ruta);
  }
}

test.describe('Sidebar: los enlaces reciben el clic', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('NAV-07 con el sidebar expandido cada enlace navega con clic real', async ({ page }) => {
    await ir(page, 'settings');
    await recorrer(page);
  });

  test('NAV-07 con el sidebar colapsado ningún título de grupo tapa el primer enlace', async ({ page }) => {
    await ir(page, 'settings');
    await page.getByRole('button', { name: 'Contraer menú' }).click();
    await expect(page.getByRole('button', { name: 'Desplegar menú' })).toBeVisible();
    await recorrer(page);
  });
});
