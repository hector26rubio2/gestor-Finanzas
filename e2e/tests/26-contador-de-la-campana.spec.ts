import { type Locator, type Page } from '@playwright/test';
import { apiUrl } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { generarNotificacionDeRoles } from '../support/notificaciones';
import { ir } from '../support/ui';

test.describe.configure({ mode: 'serial' });

interface AvisoDelApi {
  id: string;
  readAt: string | null;
}

const campana = (page: Page): Locator => page.locator('[data-tour="notificaciones"]');
const contador = (page: Page): Locator => campana(page).locator('span[aria-hidden="true"]');

async function sinLeerDelApi(page: Page): Promise<AvisoDelApi[]> {
  const respuesta = await page.request.get(`${apiUrl}/api/v1/notifications?unreadOnly=true`);
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()) as AvisoDelApi[];
}

async function leerTodasPorApi(page: Page): Promise<void> {
  for (const aviso of await sinLeerDelApi(page)) {
    const respuesta = await page.request.put(`${apiUrl}/api/v1/notifications/${aviso.id}/read`, {
      data: { isRead: true },
    });
    expect(respuesta.status()).toBeLessThan(300);
  }
}

async function esperarContador(page: Page, esperado: number): Promise<void> {
  if (esperado === 0) {
    await expect(contador(page)).toHaveCount(0);
    await expect(campana(page)).toHaveAccessibleName('Notificaciones');
    return;
  }
  await expect(contador(page)).toHaveText(String(esperado));
  await expect(campana(page)).toHaveAccessibleName(`Notificaciones, ${esperado} sin leer`);
}

test.describe('Contador de la campana', () => {
  test('sin avisos sin leer la campana no muestra punto', async ({ page }) => {
    await leerTodasPorApi(page);
    await ir(page, 'dashboard');
    await esperarContador(page, 0);
  });

  test('con avisos nuevos el número coincide con las no leídas del API, también tras recargar', async ({ page }) => {
    await generarNotificacionDeRoles(page);
    await generarNotificacionDeRoles(page);
    const esperado = (await sinLeerDelApi(page)).length;
    expect(esperado).toBeGreaterThanOrEqual(2);

    await ir(page, 'dashboard');
    await esperarContador(page, esperado);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarContador(page, esperado);
  });

  test('marcar una como leída baja el número en 1 y persiste al recargar', async ({ page }) => {
    const antes = (await sinLeerDelApi(page)).length;
    await ir(page, 'notifications');
    await esperarContador(page, antes);

    const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/read'));
    await page
      .getByRole('button', { name: /^Marcar como leída:/ })
      .first()
      .click();
    expect((await respuesta).status()).toBeLessThan(300);

    await esperarContador(page, antes - 1);
    expect(await sinLeerDelApi(page)).toHaveLength(antes - 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarContador(page, antes - 1);
  });

  test('marcar todas deja 0, el punto desaparece y persiste al recargar', async ({ page }) => {
    await ir(page, 'notifications');
    await expect(page.getByRole('button', { name: /^Marcar como leída:/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Marcar como leídas' }).click();

    await esperarContador(page, 0);
    expect(await sinLeerDelApi(page)).toHaveLength(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarContador(page, 0);
  });
});
