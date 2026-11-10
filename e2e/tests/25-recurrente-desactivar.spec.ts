import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { abrirPaleta, dialogo, elegirPendientes, guardarDialogo, ir, llenarNumerosVacios } from '../support/ui';

test.describe.configure({ mode: 'serial' });

const nombre = `E2E Gimnasio ${identificadorDeCorrida}`;
const hoy = new Date().toISOString().slice(0, 10);
const enUnAnio = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);

interface Recurrente {
  id: string;
  name: string;
}

interface Proyectada {
  recurrence: { id: string };
}

test.describe('Desactivar un recurrente', () => {
  let id = '';

  test('REC-01 crear un recurrente y verlo en el calendario', async ({ page, vigilancia }) => {
    await ir(page, 'movements');
    await abrirPaleta(page, 'Nuevo gasto recurrente');
    const formulario = dialogo(page);
    await formulario
      .getByLabel(/Nombre|Descripción/)
      .first()
      .fill(nombre);
    await llenarNumerosVacios(formulario, '70000');
    await elegirPendientes(formulario);
    await guardarDialogo(page, vigilancia, /POST .*recurrences/);

    await ir(page, 'calendar');
    const fila = page.locator('[data-tour="calendario-recurrentes"] li').filter({ hasText: nombre });
    await expect(fila).toBeVisible();

    const lista = (await (await page.request.get(`${apiUrl}/api/v1/recurrences`)).json()) as Recurrente[];
    id = lista.find((r) => r.name === nombre)?.id ?? '';
    expect(id).not.toBe('');
  });

  test('REC-02 desactivarlo por la pantalla, recargar y comprobar que ya no se proyecta ni materializa', async ({
    page,
    vigilancia,
  }) => {
    await ir(page, 'calendar');
    const fila = page.locator('[data-tour="calendario-recurrentes"] li').filter({ hasText: nombre });
    await fila.locator('[data-tour="calendario-eliminar"]').click();
    const marca = vigilancia.marca();
    await page.locator('[role=alertdialog] button').last().click();
    await expect
      .poll(() => vigilancia.exitosasDesde(marca, /DELETE .*recurrences/).length, { message: 'sin DELETE exitoso' })
      .toBeGreaterThan(0);

    await ir(page, 'calendar');
    await expect(page.locator('[data-tour="calendario-recurrentes"] li').filter({ hasText: nombre })).toHaveCount(0);

    const lista = (await (await page.request.get(`${apiUrl}/api/v1/recurrences`)).json()) as Recurrente[];
    expect(lista.map((r) => r.id)).not.toContain(id);

    const proyectadas = (await (
      await page.request.get(`${apiUrl}/api/v1/calendar/projected?from=${hoy}&to=${enUnAnio}`)
    ).json()) as Proyectada[];
    expect(proyectadas.map((p) => p.recurrence.id)).not.toContain(id);

    const materializacion = await page.request.post(`${apiUrl}/api/v1/recurrences/${id}/materializations`, {
      data: { occurrence: hoy },
    });
    expect(materializacion.status()).toBe(409);
    expect(((await materializacion.json()) as { code: string }).code).toBe('recurrence.inactive');
  });
});
