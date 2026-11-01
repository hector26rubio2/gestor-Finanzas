import { expect, type Locator, type Page } from '@playwright/test';
import { ClienteApi } from './api';
import { apiUrl, credencialesPropietario, estadoLector, webUrl } from './entorno';
import { ir } from './ui';

export type Escala = 'day' | 'week' | 'month' | 'year';

export interface Rango {
  start: string;
  end: string;
}

export interface MovimientoApi {
  id: string;
  date: string;
  kind: number;
  effect: number;
  reversalOf: string | null;
  reversedBy: string | null;
  description: string | null;
  amount: { original: { amount: string; currency: string }; base: { amount: string; currency: string } };
  links: { account: string | null; card: string | null; category: string | null };
  linkNames: { account: { name: string } | null; card: { name: string } | null; category: { name: string } | null };
}

export interface TotalesApi {
  ingresos: number;
  gastos: number;
  balance: number;
  movimientos: number;
}

const zonaDeLaPrueba = 'America/Bogota';

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaDeLaPrueba,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const aIso = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

const mediodia = (iso: string) => new Date(`${iso}T12:00:00`);

export function sumarDias(iso: string, dias: number): string {
  const fecha = mediodia(iso);
  fecha.setDate(fecha.getDate() + dias);
  return aIso(fecha);
}

export function desplazar(iso: string, escala: Escala, pasos: number): string {
  const fecha = mediodia(iso);
  if (escala === 'year') fecha.setFullYear(fecha.getFullYear() + pasos);
  else if (escala === 'month') {
    fecha.setDate(1);
    fecha.setMonth(fecha.getMonth() + pasos);
  } else fecha.setDate(fecha.getDate() + pasos * (escala === 'week' ? 7 : 1));
  return aIso(fecha);
}

export function rangoDe(ancla: string, escala: Escala): Rango {
  const a = mediodia(ancla);
  if (escala === 'day') return { start: ancla, end: ancla };
  if (escala === 'week') {
    const inicio = new Date(a);
    inicio.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    return { start: aIso(inicio), end: aIso(fin) };
  }
  if (escala === 'month')
    return {
      start: aIso(new Date(a.getFullYear(), a.getMonth(), 1, 12)),
      end: aIso(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12)),
    };
  return { start: `${a.getFullYear()}-01-01`, end: `${a.getFullYear()}-12-31` };
}

export const enRango = (fecha: string, rango: Rango) => fecha >= rango.start && fecha <= rango.end;

export async function iniciarApi(): Promise<ClienteApi> {
  const credenciales = credencialesPropietario();
  const api = new ClienteApi();
  await api.iniciarSesion(credenciales.usuario, credenciales.clave);
  return api;
}

export async function movimientosDelRango(page: Page, rango: Rango): Promise<MovimientoApi[]> {
  const todos: MovimientoApi[] = [];
  let cursor: string | undefined;
  for (let pagina = 1; pagina <= 40; pagina += 1) {
    const respuesta = await page.request.post(`${apiUrl}/api/v1/movements/search`, {
      data: { page: { page: pagina, size: 100 }, after: cursor, filter: { range: rango } },
    });
    expect(respuesta.ok(), `búsqueda de movimientos ${respuesta.status()}`).toBeTruthy();
    const cuerpo = await respuesta.json();
    todos.push(...cuerpo.items);
    if (!cuerpo.hasNext) return todos;
    cursor = cuerpo.nextCursor ?? undefined;
  }
  throw new Error('demasiadas páginas de movimientos');
}

export const importe = (movimiento: MovimientoApi) =>
  Number(movimiento.amount.base.amount) * (movimiento.reversalOf ? -1 : 1);

export function totalesDe(movimientos: readonly MovimientoApi[]): TotalesApi {
  const ingresos = movimientos.filter((m) => m.effect === 1).reduce((suma, m) => suma + importe(m), 0);
  const gastos = movimientos.filter((m) => m.effect === 2).reduce((suma, m) => suma + importe(m), 0);
  return { ingresos, gastos, balance: ingresos - gastos, movimientos: movimientos.length };
}

export async function totalesDelServidor(page: Page, rango: Rango): Promise<TotalesApi> {
  const respuesta = await page.request.get(`${apiUrl}/api/v1/dashboard?from=${rango.start}&to=${rango.end}`);
  expect(respuesta.ok()).toBeTruthy();
  const { period } = await respuesta.json();
  return {
    ingresos: Number(period.income.amount),
    gastos: Number(period.expense.amount),
    balance: Number(period.net.amount),
    movimientos: 0,
  };
}

export function numeroDe(texto: string): number {
  const digitos = texto.replace(/[^\d,-]/g, '').replace(',', '.');
  const valor = Number(digitos.replace(/-/g, ''));
  return /[-−]/.test(texto) ? -valor : valor;
}

export function etiquetaDeKpi(page: Page, etiqueta: string): Locator {
  return page.locator('fin-kpi', { has: page.locator(`span[title="${etiqueta}"]`) }).first();
}

export async function valorDeKpi(page: Page, etiqueta: string): Promise<string> {
  const kpi = etiquetaDeKpi(page, etiqueta);
  await expect(kpi).toBeVisible();
  return ((await kpi.locator('strong').first().textContent()) ?? '').trim();
}

export async function numeroDeKpi(page: Page, etiqueta: string): Promise<number> {
  return numeroDe(await valorDeKpi(page, etiqueta));
}

export async function kpisRecortados(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('fin-kpi')].flatMap((kpi) => {
      const tarjeta = kpi.getBoundingClientRect();
      return [...kpi.querySelectorAll<HTMLElement>('strong, span.line-clamp-2')]
        .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only'))
        .flatMap((el) => {
          const caja = el.getBoundingClientRect();
          const sobraAncho = el.scrollWidth > el.clientWidth + 1;
          const sobraAlto = el.scrollHeight > el.clientHeight + 1;
          const fuera =
            caja.right > tarjeta.right + 1 || caja.bottom > tarjeta.bottom + 1 || caja.left < tarjeta.left - 1;
          return sobraAncho || sobraAlto || fuera
            ? [
                `«${(el.textContent ?? '').trim().slice(0, 40)}» ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`,
              ]
            : [];
        });
    }),
  );
}

export const resumenDelPanel = (page: Page): Locator => page.locator('[data-tour=dashboard-filtros] p[role=status]');

export async function conteoDelResumen(page: Page): Promise<number> {
  const texto = (await resumenDelPanel(page).textContent()) ?? '';
  return Number(texto.match(/(\d[\d.,]*) movimientos/)?.[1].replace(/[.,]/g, '') ?? NaN);
}

export const escalaDelPanel = (page: Page, nombre: string): Locator =>
  page.locator('[data-tour=dashboard-periodo] button', { hasText: new RegExp(`^\\s*${nombre}\\s*$`) });

export const etiquetaDelPeriodo = (page: Page): Locator => page.getByRole('button', { name: /^Periodo activo:/ });

export async function elegirEscala(page: Page, nombre: 'Día' | 'Semana' | 'Mes' | 'Año'): Promise<void> {
  await escalaDelPanel(page, nombre).click();
  await expect(escalaDelPanel(page, nombre)).toHaveAttribute('aria-pressed', 'true');
}

const filtros = {
  cuenta: /^Filtrar por cuenta/,
  tipo: /^Filtrar por tipo de cuenta/,
  categoria: /^Filtrar por categoría/,
} as const;

export async function aplicarFiltro(page: Page, filtro: keyof typeof filtros, opcion: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: filtros[filtro] }).click();
  await page.getByRole('menuitemcheckbox', { name: opcion }).click();
  await page.keyboard.press('Escape');
}

export async function quitarFiltro(page: Page, etiqueta: 'Cuenta' | 'Tipo' | 'Categoría'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^Quitar filtro.*${etiqueta}|^Quitar.*${etiqueta}`) }).click();
}

export const contenedorDeTabla = (page: Page): Locator =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Movimientos del periodo', level: 2 }) }).last();

export async function descripcionesDeLaTabla(page: Page): Promise<string[]> {
  const filas = contenedorDeTabla(page).locator('tbody tr');
  await expect(filas.first()).toBeVisible();
  const textos = await filas.evaluateAll((trs) =>
    trs.map((tr) => (tr.querySelectorAll('td')[1]?.textContent ?? '').trim()),
  );
  return textos.filter((texto) => texto && !/^No hay registros|^Ningún resultado/.test(texto));
}

export async function abrirTablero(page: Page, ruta = 'dashboard'): Promise<void> {
  await ir(page, ruta);
  await expect(page.locator('fin-kpi').first()).toBeVisible();
}

export async function escribirComo(
  page: Page,
  metodo: 'POST' | 'PUT' | 'DELETE',
  ruta: string,
  datos?: unknown,
): Promise<{ estado: number; cuerpo: any }> {
  const csrf = await page.request.get(`${apiUrl}/api/v1/auth/csrf`);
  const { token } = await csrf.json();
  const respuesta = await page.request.fetch(`${apiUrl}${ruta}`, {
    method: metodo,
    headers: { 'X-CSRF-Token': token },
    data: datos,
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status(), cuerpo: texto ? JSON.parse(texto) : null };
}

export async function leerTablero(page: Page, id: string): Promise<any> {
  const respuesta = await page.request.get(`${apiUrl}/api/v1/dashboards/${id}`);
  expect(respuesta.ok(), `GET tablero ${id}: ${respuesta.status()}`).toBeTruthy();
  return respuesta.json();
}

export async function disenoDelTablero(page: Page, id: string): Promise<any> {
  const tablero = await leerTablero(page, id);
  return tablero.layoutJson ? JSON.parse(tablero.layoutJson) : null;
}

export async function tablerosDelUsuario(page: Page): Promise<any[]> {
  const respuesta = await page.request.get(`${apiUrl}/api/v1/dashboards`);
  expect(respuesta.ok()).toBeTruthy();
  return respuesta.json();
}

export async function contextoCon(browser: import('@playwright/test').Browser, estado: string) {
  const contexto = await browser.newContext({
    storageState: estado,
    baseURL: webUrl,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });
  await contexto.addInitScript(() => {
    try {
      localStorage.setItem('finanzas.tutorial.al-entrar', 'false');
    } catch {
      return;
    }
  });
  await contexto.route('**/config.js', (ruta) =>
    ruta.fulfill({
      contentType: 'application/javascript',
      body: `window.__FINANZAS_CONFIG__ = { apiBaseUrl: '${apiUrl}' };`,
    }),
  );
  return contexto;
}

export const contextoDelLector = (browser: import('@playwright/test').Browser) => contextoCon(browser, estadoLector);

export async function valorDeKpiDeResumen(page: Page, etiqueta: string): Promise<number> {
  const kpi = page.locator('fin-kpi', { has: page.getByText(etiqueta, { exact: true }) }).first();
  await expect(kpi).toBeVisible();
  return numeroDe(((await kpi.locator('strong').first().textContent()) ?? '').trim());
}
