import { provideRouter } from '@angular/router';
import type { Provider as CoreProvider } from '@angular/core';
import { P } from '@core/session';
import { CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import type { ApiMovement } from '@core/api';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { ExploradorDeReportesComponent } from './explorador/explorador';
import { ReportsTabComponent } from './reports-tab';

const RUTA_BUSQUEDA = 'POST /api/v1/movements/search';
const PAGINA_VACIA = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };
const PROVEEDORES: Array<CoreProvider> = [provideRouter([]) as unknown as CoreProvider];

interface CuerpoDeBusqueda {
  filter?: { range?: { start: string; end: string } };
  page?: { page: number; size: number };
  after?: string | null;
}

/**
 * Movimiento remoto mínimo (contrato ApiMovement) devuelto por el transport
 * falso para que la pestaña renderice datos del servidor.
 */
function movimientoRemoto(fecha: string, monto = '45900.00'): ApiMovement {
  return {
    id: 'remoto-1',
    date: fecha,
    kind: MovementKind.expense,
    effect: EconomicEffect.expense,
    flow: CashFlow.none,
    amount: {
      original: { amount: monto, currency: 'COP' },
      base: { amount: monto, currency: 'COP' },
      rate: '1',
      rateAsOf: fecha,
    },
    links: {},
    linkNames: {},
    origin: 0,
    description: 'Mercado del sábado',
    createdAt: `${fecha}T12:00:00Z`,
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
  };
}

/**
 * Ticket 05: backfill de specs para reports-tab.
 *
 * Los cálculos puros ya viven (y se cubren) en shared/proyecciones; este spec
 * describe el comportamiento de la pestaña:
 *  - qué pide al servidor al iniciar y al cambiar el rango de meses (resumen y
 *    explorador);
 *  - render mínimo con datos y estado vacío;
 *  - la granularidad del explorador es un cálculo local (no emite peticiones).
 */
describe('reports-tab: peticiones de datos al servidor', () => {
  function montar(transport: TransportFalso) {
    return pruebaRender(ReportsTabComponent, {
      session: sesionDe(),
      data: datosDe({ movements: [] }),
      transport,
      providers: PROVEEDORES,
    });
  }

  it('al iniciar pide la página 1 con el rango de los últimos 6 meses (día 1 del quinto mes atrás → hoy)', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, () => ({ body: { ...PAGINA_VACIA } }));
    const { component, store, cambios, estable } = montar(transport);
    cambios();
    await estable();

    expect(transport.peticiones).toEqual([
      {
        method: 'POST',
        path: '/api/v1/movements/search',
        body: {
          filter: {
            range: { start: inicioDeRangoDe(hoyDe(store), 6), end: hoyDe(store) },
          },
          page: { page: 1, size: 100 },
          sortBy: 0,
          direction: 1,
        },
      },
    ]);
    expect(component.cargando()).toBe(false);
  });

  it('cambiar el periodo (6 → 12 → 3 meses) reemite la petición con el rango nuevo, hoy intacto y página 1', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, () => ({ body: { ...PAGINA_VACIA } }));
    const { component, store, cambios, estable } = montar(transport);
    cambios();
    await estable();

    component.reportPeriod.set('12');
    cambios();
    await estable();
    component.reportPeriod.set('3');
    cambios();
    await estable();

    const hoy = hoyDe(store);
    const rangoDe = (peticion: { body?: unknown }) => (peticion.body as CuerpoDeBusqueda)?.filter?.range;
    expect(transport.peticiones.length).toBe(3);
    expect(transport.peticiones.map(rangoDe)).toEqual([
      { start: inicioDeRangoDe(hoy, 6), end: hoy },
      { start: inicioDeRangoDe(hoy, 12), end: hoy },
      { start: inicioDeRangoDe(hoy, 3), end: hoy },
    ]);
  });

  it('una página con hasNext encadena la página siguiente con el cursor recibido', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, (peticion) =>
      (peticion.body as CuerpoDeBusqueda)?.page?.page === 1
        ? { body: { ...PAGINA_VACIA, hasNext: true, nextCursor: 'cursor-1' } }
        : { body: { ...PAGINA_VACIA } },
    );
    const { cambios, estable } = montar(transport);
    cambios();
    await estable();

    expect(transport.peticiones.length).toBe(2);
    const [primeraPeticion, segundaPeticion] = transport.peticiones;
    expect((segundaPeticion.body as CuerpoDeBusqueda)?.after).toBe('cursor-1');
    expect((primeraPeticion.body as CuerpoDeBusqueda)?.after).toBeUndefined();
  });
});

describe('explorador de reportes: peticiones al cambiar el rango', () => {
  it('cambiar el preset reemite la búsqueda con el rango nuevo del preset (year)', async () => {
    const transport = new TransportFalso()
      .responder(RUTA_BUSQUEDA, () => ({ body: { ...PAGINA_VACIA } }))
      .responder('GET /api/v1/reports/saved', { body: [] });
    const {
      component,
      store,
      transport: t,
      cambios,
      estable,
    } = pruebaRender(ExploradorDeReportesComponent, {
      session: sesionDe(),
      data: datosDe(),
      transport,
      providers: PROVEEDORES,
    });
    cambios();
    await estable();
    // Al montar, además del periodo inicial, el explorador carga la vista guardada del servidor.
    expect(t.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual([
      'POST /api/v1/movements/search',
      'GET /api/v1/reports/saved',
    ]);

    const anio = hoyDe(store).slice(0, 4);
    component.preset.set('year');
    cambios();
    await estable();

    expect(t.peticiones.length).toBe(3);
    const nueva = t.peticiones.filter((p) => p.path === '/api/v1/movements/search')[1];
    expect(nueva.method).toBe('POST');
    expect(nueva.path).toBe('/api/v1/movements/search');
    expect(nueva.body).toEqual({
      filter: {
        range: {
          // Año calendario del ancla (hoy del store): 1 de enero → 31 de diciembre.
          start: `${anio}-01-01`,
          end: `${anio}-12-31`,
        },
      },
      page: { page: 1, size: 100 },
      sortBy: 0,
      direction: 1,
    });
  });
});

describe('reports-tab: render mínimo', () => {
  function montarResumen(transport: TransportFalso, datos = datosDe({ movements: [] })) {
    return pruebaRender(ReportsTabComponent, {
      session: sesionDe().conCapacidad(P.reportes.comparativo.ver, P.reportes.categorias.ver, P.reportes.tendencia.ver),
      data: datos,
      transport,
      providers: PROVEEDORES,
    });
  }

  it('estado vacío: KPIs presentes, tres tarjetas con el aviso de vacío y sin skeleton tras cargar', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, () => ({ body: { ...PAGINA_VACIA } }));
    const { component, fixture, cambios, estable } = montarResumen(transport);
    cambios();
    await estable();

    expect(component.cargando()).toBe(false);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('fin-kpi').length).toBeGreaterThanOrEqual(4);
    // Solo la tarjeta de categorías muestra el aviso de vacío: las series del
    // comparativo/tendencia siempre existen (con ceros), así que pintan gráfica.
    expect((raiz.textContent?.match(/No hay movimientos en el periodo/g) ?? []).length).toBe(1);
    expect(raiz.querySelectorAll('fin-chart').length).toBeGreaterThanOrEqual(2);
    expect(raiz.querySelector('fin-skeleton')).toBeNull();
  });

  it('con datos del servidor: sin skeleton y los KPIs muestran el gasto del periodo pedido', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, (peticion) => ({
      body: {
        ...PAGINA_VACIA,
        items: [movimientoRemoto((peticion.body as CuerpoDeBusqueda)?.filter?.range?.end ?? '2026-09-25')],
      },
    }));
    const { component, fixture, store, cambios, estable } = montarResumen(transport);
    cambios();
    await estable();

    expect(component.cargando()).toBe(false);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('fin-skeleton')).toBeNull();
    expect(raiz.querySelector('fin-kpi-grid')).not.toBeNull();
    expect(raiz.textContent).toContain(store.money(-45900));
    // Con gasto del periodo, los hallazgos reemplazan el aviso de "sin gastos".
    expect(raiz.textContent).not.toContain('No hay movimientos en el periodo');
  });
});

describe('explorador de reportes: granularidad y filtros locales', () => {
  it('el preset define la granularidad y los filtros locales (cuenta/categoría/flujo) no reemiten peticiones', async () => {
    const transport = new TransportFalso().responder(RUTA_BUSQUEDA, () => ({ body: { ...PAGINA_VACIA } }));
    const {
      component,
      store,
      transport: t,
      cambios,
      estable,
    } = pruebaRender(ExploradorDeReportesComponent, {
      session: sesionDe(),
      data: datosDe(),
      transport,
      providers: PROVEEDORES,
    });
    cambios();
    await estable();

    expect(component.granularidad()).toBe('month'); // last6 ≈ 180 días
    component.preset.set('month');
    cambios();
    expect(component.granularidad()).toBe('day'); // el mes en curso ≤ 45 días
    component.preset.set('custom');
    component.desde.set(diasAtras(store.hoy(), 100));
    component.hasta.set(store.hoy());
    cambios();
    expect(component.granularidad()).toBe('week'); // ~100 días

    const peticionesPrevias = [...t.peticiones];
    component.cuenta.set('cuenta-1');
    component.categoria.set('all');
    component.flujo.set('out');
    cambios();
    await estable();
    expect(t.peticiones).toEqual(peticionesPrevias);
  });
});

function diasAtras(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

/** Hoy según el store, fijado en un punto del spec (no puede cambiar de día a mitad del test). */
function hoyDe(store: { hoy(): string }): string {
  return store.hoy();
}

/**
 * Helper spec-local (independiente de @core/utils): primer día del mes que está
 * N-1 meses antes del mes de `hoy`, para N meses de ventana. Cálculo puro en
 * UTC sobre el día 1, así un bug en la reconstrucción de rangos de producción
 * ya no se autovalida con la misma función que se intenta testear.
 */
function inicioDeRangoDe(hoy: string, meses: number): string {
  const [anio, mes] = hoy.slice(0, 7).split('-').map(Number);
  // mes es 1..12: el mes destino en índice UTC 0-based es (mes - 1) - (meses - 1);
  // el desbordamiento de año lo resuelve Date.UTC.
  const destino = new Date(Date.UTC(anio, mes - meses, 1));
  return `${destino.getUTCFullYear()}-${String(destino.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
