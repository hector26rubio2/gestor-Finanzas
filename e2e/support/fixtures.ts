import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { apiUrl, archivoSemilla } from './entorno';

export interface Escritura {
  estado: number;
  metodo: string;
  ruta: string;
}

export class Vigilancia {
  readonly erroresDeConsola: string[] = [];
  readonly avisosDeConsola: string[] = [];
  readonly erroresDePagina: string[] = [];
  readonly fallosDeRed: string[] = [];
  readonly escrituras: Escritura[] = [];

  private sinSesionPermitida = false;

  permitirSinSesion(): void {
    this.sinSesionPermitida = true;
  }

  fallosInesperados(): string[] {
    if (!this.sinSesionPermitida) return this.fallosDeRed;
    return this.fallosDeRed.filter((fallo) => !/^401 GET [/]api[/]v1[/](session|events)/.test(fallo));
  }

  erroresDeConsolaInesperados(): string[] {
    if (!this.sinSesionPermitida) return this.erroresDeConsola;
    return this.erroresDeConsola.filter((error) => !error.includes('status of 401'));
  }

  aceptarErroresEsperados(): void {
    this.erroresDeConsola.length = 0;
    this.fallosDeRed.length = 0;
  }

  marca(): number {
    return this.escrituras.length;
  }

  escriturasDesde(marca: number): Escritura[] {
    return this.escrituras.slice(marca);
  }

  exitosasDesde(marca: number, patron?: RegExp): Escritura[] {
    return this.escriturasDesde(marca).filter(
      (escritura) =>
        escritura.estado >= 200 &&
        escritura.estado < 300 &&
        (!patron || patron.test(`${escritura.metodo} ${escritura.ruta}`)),
    );
  }
}

const rutaSinOrigen = (url: string) => url.replace(/^https?:\/\/[^/]+/, '');

function escuchar(page: Page, vigilancia: Vigilancia): void {
  page.on('console', (mensaje) => {
    const texto = mensaje.text().slice(0, 240);
    if (mensaje.type() === 'error') vigilancia.erroresDeConsola.push(texto);
    if (mensaje.type() === 'warning') vigilancia.avisosDeConsola.push(texto);
  });
  page.on('pageerror', (error) => vigilancia.erroresDePagina.push(error.message.slice(0, 240)));
  page.on('requestfailed', (peticion) => {
    const motivo = peticion.failure()?.errorText ?? '';
    if (motivo.includes('ERR_ABORTED')) return;
    vigilancia.fallosDeRed.push(`FALLO ${peticion.method()} ${rutaSinOrigen(peticion.url())} ${motivo}`);
  });
  page.on('response', (respuesta) => {
    const peticion = respuesta.request();
    if (!respuesta.url().startsWith(apiUrl)) return;
    const metodo = peticion.method();
    const ruta = rutaSinOrigen(respuesta.url());
    if (metodo !== 'GET' && metodo !== 'OPTIONS')
      vigilancia.escrituras.push({ estado: respuesta.status(), metodo, ruta });
    if (respuesta.status() >= 400) vigilancia.fallosDeRed.push(`${respuesta.status()} ${metodo} ${ruta}`);
  });
}

export interface Semilla {
  cuentas: { ahorros: string; corriente: string; efectivo: string; dolares: string };
  tarjeta: string;
  catalogos: Record<string, string>;
}

export const test = base.extend<{ vigilancia: Vigilancia; semilla: Semilla }>({
  context: async ({ context }, use) => {
    await context.route('**/config.js', (ruta) =>
      ruta.fulfill({
        contentType: 'application/javascript',
        body: `window.__FINANZAS_CONFIG__ = { apiBaseUrl: '${apiUrl}' };`,
      }),
    );
    await use(context);
  },
  vigilancia: [
    async ({ page }, use) => {
      const vigilancia = new Vigilancia();
      escuchar(page, vigilancia);
      await use(vigilancia);
      expect(vigilancia.erroresDePagina, 'errores JS no capturados').toEqual([]);
      expect(vigilancia.fallosInesperados(), 'peticiones fallidas').toEqual([]);
      expect(vigilancia.erroresDeConsolaInesperados(), 'errores de consola').toEqual([]);
      for (const aviso of new Set(vigilancia.avisosDeConsola))
        base.info().annotations.push({ type: 'aviso-de-consola', description: aviso });
    },
    { auto: true },
  ],
  semilla: async ({}, use) => {
    await use(JSON.parse(readFileSync(archivoSemilla, 'utf8')));
  },
});

export { expect };
export type { Locator, Page };
