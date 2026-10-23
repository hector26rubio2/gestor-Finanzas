import { provideRouter } from '@angular/router';
import type { Provider as CoreProvider } from '@angular/core';
import { addMonthsToIso } from '@core/utils';
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
 *  - qué pide al servidor al iniciar y al cambiar el rango de meses;
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
            range: {
              start: `${addMonthsToIso(`${store.hoy().slice(0, 7)}-01`, -5).slice(0, 7)}-01`,
              end: store.hoy(),
            },
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

    const hoy = store.hoy();
    const inicioEsperado = (meses: number) =>
      `${addMonthsToIso(`${hoy.slice(0, 7)}-01`, -meses + 1).slice(0, 7)}-01`;
    const rangoDe = (peticion: { body?: unknown }) => (peticion.body as CuerpoDeBusqueda)?.filter?.range;
    expect(transport.peticiones.length).toBe(3);
    expect(transport.peticiones.map(rangoDe)).toEqual([
      { start: inicioEsperado(6), end: hoy },
      { start: inicioEsperado(12), end: hoy },
      { start: inicioEsperado(3), end: hoy },
    ]);
  });

  it('una página con hasNext encadena la página siguiente con el cursor recibido', async () => {
    const transport = new TransportFalso().responder(
      RUTA_BUSQUEDA,
      (peticion) =>
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

describe('reports-tab: render mínimo', () => {
  function montarResumen(transport: TransportFalso, datos = datosDe({ movements: [] })) {
    return pruebaRender(ReportsTabComponent, {
      session: sesionDe().conCapacidad(
        P.reportes.comparativo.ver,
        P.reportes.categorias.ver,
        P.reportes.tendencia.ver,
      ),
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
    const { component, store, transport: t, cambios, estable } = pruebaRender(ExploradorDeReportesComponent, {
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
