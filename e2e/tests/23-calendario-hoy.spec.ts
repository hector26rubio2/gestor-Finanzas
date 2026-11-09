import { apiUrl } from '../support/entorno';
import { expect, test, type Page } from '../support/fixtures';
import { ir } from '../support/ui';

test.describe.configure({ mode: 'serial' });

const hoyEnBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const diaDeHoy = () => String(Number(hoyEnBogota().slice(8)));

const idiomas = [
  { nombre: 'es', codigo: 'es-CO' },
  { nombre: 'en', codigo: 'en-US' },
  { nombre: 'pt', codigo: 'pt-BR' },
  { nombre: 'fr', codigo: 'fr-FR' },
];

const vistas = ['day', 'week', 'month', 'year'] as const;

const titulo = (page: Page) =>
  page.locator('[data-tour=calendario-hoy]').locator('xpath=ancestor::header').locator('strong');
const boton = (page: Page, marca: 'calendario-hoy' | 'calendario-siguiente' | 'calendario-anterior') =>
  page.locator(`[data-tour=${marca}]`);
const diaMarcado = (page: Page) => page.locator('[data-slot=calendar-day][aria-pressed=true]');

async function fijarIdioma(page: Page, codigo: string): Promise<void> {
  const lectura = await page.request.get(`${apiUrl}/api/v1/preferences`);
  const preferencias = await lectura.json();
  const guardado = await page.request.put(`${apiUrl}/api/v1/preferences`, {
    data: { ...preferencias, language: codigo },
  });
  expect(guardado.status()).toBeLessThan(300);
}

async function elegirVista(page: Page, vista: (typeof vistas)[number]): Promise<void> {
  await page.locator('[data-tour=calendario-vistas] button').nth(vistas.indexOf(vista)).click();
  await expect(page.locator('[data-tour=calendario-vistas] button').nth(vistas.indexOf(vista))).toHaveAttribute(
    'data-active',
    'true',
  );
}

async function avanzarYVolverAHoy(page: Page, vista: (typeof vistas)[number]): Promise<void> {
  await elegirVista(page, vista);
  const actual = ((await titulo(page).textContent()) ?? '').trim();
  expect(actual).not.toBe('');

  await boton(page, 'calendario-siguiente').click();
  await boton(page, 'calendario-siguiente').click();
  await expect(titulo(page)).not.toHaveText(actual);

  await boton(page, 'calendario-hoy').click();
  await expect(titulo(page)).toHaveText(actual);

  if (vista === 'year') await elegirVista(page, 'month');
  await expect(diaMarcado(page).locator('b')).toHaveText(diaDeHoy());
}

test.describe('Calendario: botón Hoy', () => {
  for (const { nombre, codigo } of idiomas) {
    test(`CAL-05 «Hoy» vuelve al mes y al día actuales en todas las vistas (${nombre})`, async ({ page }) => {
      await fijarIdioma(page, codigo);
      try {
        await ir(page, 'calendar');
        for (const vista of vistas) await avanzarYVolverAHoy(page, vista);
      } finally {
        await fijarIdioma(page, 'es-CO');
      }
    });
  }

  test('CAL-05 «Hoy» sigue funcionando tras recargar la página', async ({ page }) => {
    await ir(page, 'calendar');
    const actual = ((await titulo(page).textContent()) ?? '').trim();
    await boton(page, 'calendario-siguiente').click();
    await boton(page, 'calendario-siguiente').click();
    await expect(titulo(page)).not.toHaveText(actual);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(titulo(page)).toHaveText(actual);
    await expect(diaMarcado(page).locator('b')).toHaveText(diaDeHoy());

    await boton(page, 'calendario-siguiente').click();
    await boton(page, 'calendario-siguiente').click();
    await boton(page, 'calendario-siguiente').click();
    await expect(titulo(page)).not.toHaveText(actual);
    await boton(page, 'calendario-hoy').click();
    await expect(titulo(page)).toHaveText(actual);
    await expect(diaMarcado(page)).toHaveCount(1);
    await expect(diaMarcado(page).locator('b')).toHaveText(diaDeHoy());
  });
});
