import { expect, test } from '../support/fixtures';
import { atajo, dialogo, elegir, ir } from '../support/ui';

test.describe('El «+» de alta en línea se entiende', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('ALT-01 el «+» de categoría pasa a «X» al abrir y vuelve a «+» al cancelar', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    const boton = formulario.locator('[data-tour=form-categoria-nueva]');
    await expect(boton).toHaveAccessibleName('Nueva categoría');
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(boton.locator('fin-icon[name=plus]')).toHaveCount(1);

    await boton.click();
    await expect(boton).toHaveAccessibleName('Cancelar');
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(boton.locator('fin-icon[name=close]')).toHaveCount(1);
    await expect(formulario.locator('input[name=nuevaCategoria]')).toBeVisible();

    await boton.click();
    await expect(boton).toHaveAccessibleName('Nueva categoría');
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(boton.locator('fin-icon[name=plus]')).toHaveCount(1);
    await expect(formulario.locator('input[name=nuevaCategoria]')).toHaveCount(0);
  });

  test('ALT-02 Escape dentro del alta la cancela sin cerrar el formulario ni borrar lo escrito', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await formulario.locator('input[name=description]').fill('E2E se conserva');
    await formulario.locator('[data-tour=form-categoria-nueva]').click();
    const alta = formulario.locator('input[name=nuevaCategoria]');
    await alta.fill('Borrador');
    await alta.press('Escape');

    await expect(alta).toHaveCount(0);
    await expect(formulario).toBeVisible();
    await expect(formulario.locator('input[name=description]')).toHaveValue('E2E se conserva');
    await expect(formulario.locator('[data-tour=form-categoria-nueva]')).toBeFocused();

    await formulario.locator('input[name=description]').press('Escape');
    await expect(formulario).toBeHidden();
  });

  test('ALT-03 el «+» de persona se comporta igual que el de categoría', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await elegir(formulario, 'Tipo:', 'Compra con tarjeta prestada');
    const boton = formulario.locator('[data-tour=form-contraparte-nueva]');
    await expect(boton).toHaveAccessibleName('Nueva persona');

    await boton.click();
    await expect(boton).toHaveAccessibleName('Cancelar');
    await expect(boton.locator('fin-icon[name=close]')).toHaveCount(1);
    await formulario.locator('input[name=nuevaContraparte]').press('Escape');

    await expect(formulario.locator('input[name=nuevaContraparte]')).toHaveCount(0);
    await expect(formulario).toBeVisible();
    await expect(boton).toHaveAccessibleName('Nueva persona');
  });
});
