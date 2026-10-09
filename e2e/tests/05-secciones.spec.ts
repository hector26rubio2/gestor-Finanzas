import { identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { generarNotificacionDeRoles } from '../support/notificaciones';
import { dialogo, ir } from '../support/ui';

const corrida = identificadorDeCorrida;

const nombreDeMes =
  /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) (de )?\d{4}/i;

test.describe.configure({ mode: 'serial' });

test.describe('Secciones', () => {
  test('notificaciones: marcar una notificación como leída', async ({ page, vigilancia }) => {
    await generarNotificacionDeRoles(page);
    await ir(page, 'notifications');
    const marcar = page.getByRole('button', { name: /^Marcar como leída:/ }).first();
    await expect(marcar).toBeVisible();
    const marca = vigilancia.marca();
    await marcar.click();
    await expect.poll(() => vigilancia.exitosasDesde(marca).length).toBeGreaterThan(0);
  });

  test('notificaciones: marcar todas como leídas deja la lista sin pendientes', async ({ page, vigilancia }) => {
    await generarNotificacionDeRoles(page);
    await ir(page, 'notifications');
    await expect(page.getByRole('button', { name: /^Marcar como leída:/ }).first()).toBeVisible();
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Marcar como leídas' }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca).length).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /^Marcar como leída:/ })).toHaveCount(0);
  });

  test('preferencias: cambiar el idioma a inglés y volver a español', async ({ page }) => {
    await ir(page, 'settings');
    await page.locator('[data-slot=select-trigger][aria-label^="Idioma"]').click();
    await page
      .locator('[role=option]', { hasText: /English/ })
      .first()
      .click();
    try {
      await expect(page.locator('nav, [data-slot=sidebar]').first()).toContainText(/Transactions/);
    } finally {
      await page.locator('[data-slot=select-trigger][aria-label^="Language"]').click();
      await page
        .locator('[role=option]', { hasText: /Español/ })
        .first()
        .click();
    }
    await expect(page.locator('nav, [data-slot=sidebar]').first()).toContainText(/Movimientos/);
  });

  test('reportes: exportar descarga un archivo', async ({ page }) => {
    await ir(page, 'reports');
    const descarga = page.waitForEvent('download');
    await page
      .getByRole('button', { name: /Exportar|Descargar|CSV/i })
      .first()
      .click();
    expect((await descarga).suggestedFilename()).not.toBe('');
  });

  test('CAL-04 calendario: avanzar y retroceder de mes', async ({ page }) => {
    await ir(page, 'calendar');
    const titulo = async () => (await page.locator('main').innerText()).match(nombreDeMes)?.[0] ?? '';
    const antes = await titulo();
    expect(antes).not.toBe('');
    await page.getByRole('button', { name: 'Periodo siguiente' }).click();
    await expect.poll(titulo).not.toBe(antes);
    await page.getByRole('button', { name: 'Periodo anterior' }).click();
    await expect.poll(titulo).toBe(antes);
  });

  test('DAS-05 crear un tablero nuevo', async ({ page, vigilancia }) => {
    await ir(page, 'dashboard');
    await page
      .getByRole('button', { name: /Nuevo tablero/i })
      .first()
      .click();
    await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill(`E2E tablero ${corrida}`);
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*dashboards/).length).toBeGreaterThan(0);
  });

  test('planificación: guardar un plan de deudas como nuevo', async ({ page, vigilancia }) => {
    await ir(page, 'planning');
    await page
      .getByRole('button', { name: /Guardar como nuevo/i })
      .first()
      .click();
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(`E2E plan deudas ${corrida}`);
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*planning/).length).toBeGreaterThan(0);
  });

  test('reporte de error: el botón flotante abre el formulario sin enviarlo', async ({ page }) => {
    await ir(page, 'dashboard');
    await page
      .getByRole('button', { name: /Reportar|error|problema/i })
      .last()
      .click();
    await expect(dialogo(page)).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
