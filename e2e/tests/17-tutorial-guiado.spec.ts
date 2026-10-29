import { expect, test } from '../support/fixtures';
import { ir } from '../support/ui';

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
    await expect(page.getByRole('switch', { name: 'Ofrecer el tutorial al entrar' })).toBeChecked();
  });
});
