import { expect, type Locator, type Page } from '@playwright/test';
import { apiUrl } from './entorno';
import type { Vigilancia } from './fixtures';

export const dialogo = (page: Page): Locator => page.locator('[role=dialog]').last();

export const panelLateral = (page: Page): Locator => page.locator('[role=dialog], [data-slot=sheet-content]').last();

export async function ir(page: Page, ruta: string): Promise<void> {
  await page.goto(`/${ruta}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page], fin-sin-seccion').first()).toBeVisible();
}

export async function enfocarContenido(page: Page): Promise<void> {
  await page
    .locator('main')
    .first()
    .click({ position: { x: 3, y: 3 } });
}

export async function atajo(page: Page, ...teclas: string[]): Promise<void> {
  await enfocarContenido(page);
  for (const tecla of teclas) await page.keyboard.press(tecla);
}

export async function abrirPaleta(page: Page, texto: string): Promise<void> {
  await page.keyboard.press('Control+k');
  const entrada = dialogo(page).locator('input').first();
  await expect(entrada).toBeFocused();
  await entrada.fill(texto);
  await page.keyboard.press('Enter');
}

export async function guardarDialogo(
  page: Page,
  vigilancia: Vigilancia,
  patron: RegExp,
  boton = 'button[type=submit]',
): Promise<void> {
  const formulario = dialogo(page);
  const marca = vigilancia.marca();
  await formulario.locator(boton).last().click();
  await expect
    .poll(() => vigilancia.exitosasDesde(marca, patron).length, { message: `sin escritura exitosa ${patron}` })
    .toBeGreaterThan(0);
}

export async function llenarNumerosVacios(contenedor: Locator, valor: string): Promise<void> {
  const numeros = contenedor.locator('input[type=number]');
  const total = await numeros.count();
  for (let i = 0; i < total; i += 1) {
    if (Number(await numeros.nth(i).inputValue()) <= 0) await numeros.nth(i).fill(valor);
  }
}

export async function elegir(contenedor: Locator, etiqueta: string, opcion?: string | RegExp): Promise<void> {
  const page = contenedor.page();
  await contenedor.locator(`[data-slot=select-trigger][aria-label^="${etiqueta}"]`).first().click();
  const opciones = page.locator('[role=option]');
  const objetivo = opcion
    ? opciones.filter({ hasText: opcion }).first()
    : opciones.filter({ hasNotText: /^\s*Selecciona/ }).first();
  await objetivo.click();
  await expect(opciones.first()).toBeHidden();
}

export async function elegirPendientes(contenedor: Locator): Promise<void> {
  for (let vuelta = 0; vuelta < 6; vuelta += 1) {
    const etiquetas = await contenedor.locator('[data-slot=select-trigger]').evaluateAll((disparadores) =>
      disparadores
        .filter((d) => (d as HTMLElement).offsetParent !== null)
        .map((d) => d.getAttribute('aria-label') ?? '')
        .filter((etiqueta) => /:\s*(Selecciona\w*)?\s*$/i.test(etiqueta)),
    );
    if (!etiquetas.length) return;
    await elegir(contenedor, etiquetas[0].replace(/:.*$/, ':'));
  }
}

export interface BusquedaDeMovimientos {
  items: {
    id: string;
    kind: number;
    description: string | null;
    amount: { original: { amount: string; currency: string } };
    reversedBy?: unknown;
  }[];
}

export async function buscarMovimientos(page: Page, texto: string): Promise<BusquedaDeMovimientos['items']> {
  const respuesta = await page.request.post(`${apiUrl}/api/v1/movements/search`, {
    data: { page: { page: 1, size: 20 }, filter: { text: texto } },
  });
  expect(respuesta.ok()).toBeTruthy();
  return ((await respuesta.json()) as BusquedaDeMovimientos).items;
}

export async function esperarMovimiento(page: Page, descripcion: string, monto: number): Promise<void> {
  await expect
    .poll(async () => (await buscarMovimientos(page, descripcion)).map((m) => Number(m.amount.original.amount)), {
      message: `el libro debe contener «${descripcion}» por ${monto}`,
    })
    .toContain(monto);
}

export async function guardarMovimiento(
  page: Page,
  vigilancia: Vigilancia,
  opciones: { monto?: number; descripcion: string; selecciones?: Record<string, string | RegExp> },
): Promise<string> {
  const formulario = dialogo(page);
  await formulario.waitFor({ state: 'visible' });
  if (opciones.monto !== undefined) await formulario.locator('input[name=amount]').fill(String(opciones.monto));
  for (const [etiqueta, opcion] of Object.entries(opciones.selecciones ?? {}))
    await elegir(formulario, etiqueta, opcion);
  await elegirPendientes(formulario);
  await formulario.locator('input[name=description]').fill(opciones.descripcion);
  const marca = vigilancia.marca();
  await formulario.locator('button[type=submit]').click();
  await expect(formulario).toBeHidden();
  const exitosas = vigilancia.exitosasDesde(marca);
  expect(exitosas.length, `escrituras: ${JSON.stringify(vigilancia.escriturasDesde(marca))}`).toBeGreaterThan(0);
  expect(vigilancia.escriturasDesde(marca).filter((e) => e.estado >= 400)).toEqual([]);
  return exitosas.map((e) => `${e.metodo} ${e.ruta}`).join(' ');
}
