import { readFileSync } from 'node:fs';
import { archivoSemilla, identificadorDeCorrida } from '../support/entorno';
import { expect, test } from '../support/fixtures';
import { elegir } from '../support/ui';
import {
  abrirTablero,
  aplicarFiltro,
  hoy,
  iniciarApi,
  rangoDe,
  desplazar,
  totalesDelServidor,
  type Rango,
} from '../support/tablero';
import type { Locator, Page } from '../support/fixtures';

const corrida = identificadorDeCorrida;
const categoriaDeGasto = `E2E Ahorro gasto ${corrida}`;
const descripcionSinIngreso = `E2E ahorro sin ingreso ${corrida}`;
const montoIngreso = 2_000_000;
const montoGasto = 750_000;

const formato = (totales: { ingresos: number; balance: number }) =>
  totales.ingresos > 0 ? `${Math.round((totales.balance / totales.ingresos) * 100)} %` : '—';

const mesActual = rangoDe(hoy(), 'month');
const ventanaDeReportes: Rango = { start: rangoDe(desplazar(hoy(), 'month', -2), 'month').start, end: hoy() };

function valorDeTasa(page: Page): Locator {
  return page
    .locator('main fin-kpi', { has: page.getByText('Tasa de ahorro', { exact: true }) })
    .first()
    .locator('strong')
    .first();
}

async function leerTasa(page: Page): Promise<string> {
  return ((await valorDeTasa(page).textContent()) ?? '').trim();
}

async function elegirMesActualEnMovimientos(page: Page): Promise<void> {
  const fecha = new Date(`${hoy()}T12:00:00`);
  const mes = new Intl.DateTimeFormat('es', { month: 'long' }).format(fecha);
  const main = page.locator('main');
  await elegir(main, 'Año', String(fecha.getFullYear()));
  await elegir(main, 'Mes', new RegExp(`^\s*${mes}`, 'i'));
}

test.describe.configure({ mode: 'serial' });

test.describe('Tasa de ahorro: una sola cifra por periodo', () => {
  test.beforeAll(async () => {
    const api = await iniciarApi();
    const semilla = JSON.parse(readFileSync(archivoSemilla, 'utf8'));
    const categoria = await api.exigir('POST', '/api/v1/categories', {
      name: categoriaDeGasto,
      type: 2,
      color: '#7c3aed',
      icon: 'cart',
    });
    await api.exigir('POST', '/api/v1/movements', {
      date: hoy(),
      kind: 1,
      effect: 1,
      flow: 1,
      amount: { amount: String(montoIngreso), currency: 'COP' },
      links: { account: semilla.cuentas.ahorros, category: semilla.catalogos.salario },
      description: `E2E ahorro ingreso ${corrida}`,
      idempotencyKey: `e2e-ahorro-${corrida}-ingreso`,
    });
    await api.exigir('POST', '/api/v1/movements', {
      date: hoy(),
      kind: 2,
      effect: 2,
      flow: 2,
      amount: { amount: String(montoGasto), currency: 'COP' },
      links: { account: semilla.cuentas.ahorros, category: categoria.id },
      description: descripcionSinIngreso,
      idempotencyKey: `e2e-ahorro-${corrida}-gasto`,
    });
  });

  test('AHO-01 Dashboard y Movimientos muestran la misma tasa de ahorro del mes y Reportes la de su ventana', async ({
    page,
  }) => {
    const esperadaDelMes = formato(await totalesDelServidor(page, mesActual));
    expect(esperadaDelMes).not.toBe('—');

    await abrirTablero(page, 'dashboard?vista=resumen');
    await expect.poll(() => leerTasa(page), { message: 'tasa en Dashboard' }).toBe(esperadaDelMes);

    await page.goto('/movements', { waitUntil: 'domcontentloaded' });
    await elegirMesActualEnMovimientos(page);
    await expect.poll(() => leerTasa(page), { message: 'tasa en Movimientos' }).toBe(esperadaDelMes);

    const esperadaDeReportes = formato(await totalesDelServidor(page, ventanaDeReportes));
    await page.goto('/reports?meses=3', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => leerTasa(page), { message: 'tasa en Reportes' }).toBe(esperadaDeReportes);
  });

  test('AHO-02 sin ingresos la tasa de ahorro es «sin dato» y no 0 %', async ({ page }) => {
    await abrirTablero(page, 'dashboard?vista=resumen');
    await aplicarFiltro(page, 'categoria', categoriaDeGasto);
    await expect.poll(() => leerTasa(page), { message: 'sin dato en Dashboard' }).toBe('—');

    await page.goto('/movements', { waitUntil: 'domcontentloaded' });
    const buscador = page.locator('main input[type=search], main input[placeholder*="Buscar"]').first();
    await buscador.fill(descripcionSinIngreso);
    await buscador.press('Enter');
    await expect(page.locator('main table tbody tr').filter({ hasText: descripcionSinIngreso })).toHaveCount(1);
    await expect.poll(() => leerTasa(page), { message: 'sin dato en Movimientos' }).toBe('—');
  });
});
