import { expect, test } from '../support/fixtures';
import { ir } from '../support/ui';
import type { Page } from '@playwright/test';

test.describe('Tutorial guiado', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('TUT-01 desde Preferencias se lanza, avanza con Siguiente y Escape lo cierra', async ({ page }) => {
    await ir(page, 'settings?section=tutorial');
    const popover = page.locator('.driver-popover');
    await expect(popover).toHaveCount(0);

    await page.getByTestId('ver-tutorial').click();
    await expect(popover).toBeVisible();
    const primerTitulo = await popover.locator('.driver-popover-title').innerText();
    await expect(popover.locator('.driver-popover-progress-text')).toContainText('1');

    await popover.getByRole('button', { name: 'Siguiente' }).click();
    await expect(popover.locator('.driver-popover-title')).not.toHaveText(primerTitulo);
    await expect(popover.locator('.driver-popover-progress-text')).toContainText('2');

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(page.getByTestId('ver-tutorial')).toBeFocused();
  });

  test('TUT-02 el interruptor de ofrecer al entrar queda guardado', async ({ page }) => {
    await ir(page, 'settings?section=tutorial');
    const interruptor = page.getByRole('switch', { name: 'Ofrecer el tutorial al entrar' });
    await expect(interruptor).not.toBeChecked();
    await interruptor.click();
    await expect(interruptor).toBeChecked();
    await page.reload();
    await page.getByTestId('oferta-ahora-no').click();
    await expect(page.getByRole('switch', { name: 'Ofrecer el tutorial al entrar' })).toBeChecked();
  });

  test('TUT-03 el centro lanza «Registrar un gasto»: abre el formulario, señala el monto y al cerrar lo cierra', async ({
    page,
  }) => {
    await ir(page, 'settings?section=tutorial');
    await page.getByTestId('abrir-centro-de-tutoriales').click();
    const centro = page.getByTestId('centro-de-tutoriales');
    await expect(centro).toBeVisible();
    await page.getByTestId('buscar-tutorial').fill('gasto');
    const tarjeta = centro.locator('[data-guia="gasto"]');
    await expect(tarjeta).toBeVisible();
    await expect(centro.locator('[data-guia="crear-widget"]')).toHaveCount(0);
    await tarjeta.getByRole('button', { name: 'Empezar' }).click();

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible();
    await expect(page.locator('[data-tour="form-tipo"]')).toBeVisible();
    await popover.getByRole('button', { name: 'Siguiente' }).click();
    await popover.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('[data-tour="form-monto"] .driver-active-element')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(page.locator('[data-tour="form-monto"]')).toHaveCount(0);
  });

  test('TUT-04 cambiar el idioma en la oferta cambia el texto de inmediato', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('finanzas.tutorial.al-entrar', 'true'));
    await ir(page, 'dashboard');
    const oferta = page.getByTestId('oferta-del-tutorial');
    await expect(oferta).toBeVisible();
    await expect(page.getByText('¿Quieres un recorrido por la aplicación?')).toBeVisible();
    try {
      await oferta.getByRole('tab', { name: 'English' }).click();
      await expect(page.getByText('Would you like a tour of the app?')).toBeVisible();
    } finally {
      await oferta.getByRole('tab', { name: 'Español' }).click();
      await expect(page.getByText('¿Quieres un recorrido por la aplicación?')).toBeVisible();
    }
  });

  const iniciarGuia = async (page: Page, ruta: string, busqueda: string) => {
    await ir(page, ruta);
    await page.keyboard.press('Control+k');
    const entrada = page.locator('[role=dialog]').last().locator('input').first();
    await entrada.fill(busqueda);
    await page.keyboard.press('Enter');
    await expect(page.locator('.driver-popover')).toBeVisible();
  };

  test('TUT-05 la guía de compra con tarjeta abre el formulario con la tarjeta de crédito', async ({ page }) => {
    await iniciarGuia(page, 'movements', 'compra con tarjeta');
    await expect(page.locator('[role=dialog] [data-tour="form-cuenta"]')).toBeVisible();
    await expect(page.locator('.driver-active-element')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
  });

  test('TUT-06 la guía de operaciones de inversión abre el detalle y el formulario', async ({ page }) => {
    await iniciarGuia(page, 'portfolio', 'aportes retiros');
    await expect(page.locator('[data-tour="detalle-operacion"]')).toBeVisible();
    await page.locator('.driver-popover').getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('[data-tour="form-operacion-tipo"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await expect(page.locator('[role=dialog], [data-slot=sheet-content]')).toHaveCount(0);
  });

  test('TUT-07 la guía de crear widget entra en personalizar, abre el creador y lo cierra al salir', async ({
    page,
  }) => {
    await iniciarGuia(page, 'dashboard', 'crear un widget');
    await page.locator('.driver-popover').getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('[data-tour="dashboard-panel"]')).toBeVisible();
    await page.locator('.driver-popover').getByRole('button', { name: 'Siguiente' }).click();
    await page.locator('.driver-popover').getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('[data-tour="widget-nombre"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await expect(page.locator('[data-tour="widget-nombre"]')).toHaveCount(0);
    await expect(page.locator('[data-tour="dashboard-panel"]')).toHaveCount(0);
  });
});
