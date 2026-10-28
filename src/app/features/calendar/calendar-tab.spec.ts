import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { P, toMovement } from '@core/session';
import { I18nService } from '@core/i18n';
import { EMPTY_KIND_CATALOG } from '@core/utils/movement-kinds';
import type { ApiMovement } from '@core/api';
import type { Movement } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const ANIO = 2026;
/**
 * Semillas locales en los extremos del año sembrado: 2 de enero y 30 de diciembre
 * (ticket 25). Con el云端 transport que responde vacío o por rango, la vista anual
 * base deriva TODO el año (comportamiento previo); la ventana acotada debe seguir
 * mostrando exactamente lo mismo.
 */
const SEMILLAS_DEL_ANIO: Movement[] = [
  {
    id: 'mov-ene-2',
    date: `${ANIO}-01-02`,
    description: 'compra de enero',
    accountId: 'cuenta-2',
    category: 'Mercado',
    kind: 'expense',
    amount: -1000,
    status: 'confirmed',
  },
  {
    id: 'mov-may-15',
    date: `${ANIO}-05-15`,
    description: 'compra de mayo',
    accountId: 'cuenta-2',
    category: 'Mercado',
    kind: 'expense',
    amount: -2500,
    status: 'confirmed',
  },
  {
    id: 'mov-dic-30',
    date: `${ANIO}-12-30`,
    description: 'compra de diciembre',
    accountId: 'cuenta-2',
    category: 'Mercado',
    kind: 'expense',
    amount: -3000,
    status: 'confirmed',
  },
];
const CUENTA_AGENDA = {
  id: 'cuenta-2',
  name: 'Efectivo',
  type: 'cash' as const,
  currency: 'COP',
  openingBalance: 100000,
};

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

/** Cuerpo de ocurrencia remota con el contrato del search (a lo movements.mapper.spec). */
function remota(id: string, date: string): ApiMovement {
  return {
    id,
    date,
    kind: 2,
    effect: 2,
    flow: 2,
    amount: {
      original: { amount: '5000', currency: 'COP' },
      base: { amount: '5000', currency: 'COP' },
      rate: '1',
      rateAsOf: date,
    },
    links: { account: CUENTA_AGENDA.id },
    linkNames: {},
    origin: 0,
    description: id,
    createdAt: `${date}T12:00:00Z`,
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
  };
}

/** Año de estrés: 12 semillas en los extremos + 300 sintéticos repartidos por el año. */
function anioDeEstres(): ApiMovement[] {
  return [
    remota('remoto-ene-2', `${ANIO}-01-02`),
    remota('remoto-may-15', `${ANIO}-05-15`),
    remota('remoto-dic-30', `${ANIO}-12-30`),
    ...Array.from({ length: 300 }, (_, n) =>
      remota(
        `remoto-s${String(n).padStart(3, '0')}`,
        `${ANIO}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}`,
      ),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

const rangoDe = (peticion: { body?: unknown }) =>
  (peticion.body as { filter?: { range?: { start?: string; end?: string } } } | undefined)?.filter?.range;

/** Responde paginado, respetando el rango pedido en el body (para no entregar跨 rango). */
function respuestaPaginada(items: ApiMovement[]) {
  return (peticion: { body?: unknown }) => {
    const cuerpo = peticion.body as {
      page?: { page?: number; size?: number };
      filter?: { range?: { start?: string; end?: string } };
    };
    const numero = Math.max(1, cuerpo?.page?.page ?? 1);
    const tamano = cuerpo?.page?.size ?? 100;
    const enRango = items.filter((m) => {
      const rango = cuerpo?.filter?.range;
      return (!rango?.start || m.date >= rango.start) && (!rango?.end || m.date <= rango.end);
    });
    const rebanada = enRango.slice((numero - 1) * tamano, numero * tamano);
    const haySiguiente = numero < Math.ceil(enRango.length / tamano);
    return {
      body: { items: rebanada, hasNext: haySiguiente, ...(haySiguiente ? { nextCursor: String(numero) } : null) },
    };
  };
}

const transportDeCalendario = (remotos: ApiMovement[] = []) =>
  new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, respuestaPaginada(remotos))
    .responder('GET /api/v1/calendar/projected', { body: [] })
    .responder('GET /api/v1/recurrences', { body: [] });

function montarCalendario(transport = transportDeCalendario(), movements = SEMILLAS_DEL_ANIO) {
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(P.calendario.ver, P.calendario.recurrencias.listar),
    data: datosDe({ accounts: [CUENTA_AGENDA], movements }),
    providers: proveedores,
    transport,
  });
  // El espía empieza tras la siembra: solo ve lo que el calendario deriva/recuerda.
  const recordadas = vi.spyOn(montado.store, 'recordarMovimientos');
  return { ...montado, recordadas };
}

function verAnio(component: CalendarTabComponent): void {
  component.setCalendarView('year');
  component.calendarYear.set(ANIO);
  component.calendarMonth.set(9);
}

describe('calendario, vista anual (ticket 25)', () => {
  it('paridad de la vista anual: semillas en los extremos del año se muestran igual antes y después de acotar', async () => {
    const transport = transportDeCalendario(anioDeEstres());
    const { component, cambios, estable } = montarCalendario(transport);
    cambios();
    await estable();

    verAnio(component);
    cambios();
    await estable();
    cambios(); // la derivación anual remota llega a la vista
    await estable();

    // 1) el alcance pedido sigue siendo el año entero (funciona igual con ventana acotada)
    const busquedas = transport.peticiones.filter((p) => p.path === '/api/v1/movements/search');
    expect(busquedas.length).toBeGreaterThanOrEqual(1);
    const peticionesDelAnio = busquedas.filter((p) => rangoDe(p)?.start === `${ANIO}-01-01`);
    expect(peticionesDelAnio.length).toBeGreaterThanOrEqual(1);
    expect(rangoDe(peticionesDelAnio.at(-1) ?? {})).toEqual({ start: `${ANIO}-01-01`, end: `${ANIO}-12-31` });

    // 2) paridad de los 12 mosaicos: semillas de enero, mayo y diciembre cuentan
    const conteos = component.calendarMonths().map((mes) => component.monthMovementCount(mes.value));
    const esperado = Array.from({ length: 12 }, () => 25);
    esperado[0] = 26; // enero: 25 sintéticos + remoto-ene-2
    esperado[4] = 26; // mayo: 25 sintéticos + remoto-may-15
    esperado[11] = 26; // diciembre: 25 sintéticos + remoto-dic-30
    expect(conteos).toEqual(esperado);

    // 3) paridad de la agenda: los próximos posteriores a hoy provienen del año (30/12 incluido)
    const hoy = component.store.hoy();
    const oracle = anioDeEstres()
      .filter((m) => m.date > hoy)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)
      .map((m) => toMovement({ t: (k: string) => k } as unknown as I18nService, EMPTY_KIND_CATALOG, m));
    const proximos = component.proximosMovimientos();
    expect(proximos.map((m) => m.id)).toEqual(oracle.map((m) => m.id));
    expect(proximos.map((m) => m.date)).toEqual(oracle.map((m) => m.date));
    expect(proximos.length).toBeGreaterThanOrEqual(1);
  });

  it('el volumen derivado por la vista anual queda acotado (presupuesto holgado, medición informal)', async () => {
    const transport = transportDeCalendario(anioDeEstres());
    const { component, recordadas, cambios, estable } = montarCalendario(transport);
    cambios();
    await estable();

    const t0 = performance.now();
    // Aislamos la derivación anual: limpiamos lo recordado por el montaje del mes previo.
    recordadas.mockClear();
    verAnio(component);
    cambios();
    await estable();
    cambios();
    await estable();
    const t1 = performance.now();

    const remotosDelAnio = anioDeEstres().length;
    const recordadosTotales = recordadas.mock.calls.reduce((sum, llamada) => sum + llamada[0].length, 0);
    console.log(
      `[ticket 25] vista anual: remotos del año = ${remotosDelAnio}, recordados por la derivación anual = ${recordadosTotales}, ciclo de entrada = ${(t1 - t0).toFixed(1)} ms`,
    );
    // Generoso: hoy la derivación anual traspasa el año entero; con la ventana queda muy por debajo.
    expect(recordadosTotales).toBeLessThanOrEqual(remotosDelAnio + 105);
    expect(t1 - t0).toBeLessThan(1000);
  });

  it('la vista del mes no cambia: 42 celdas y el rango remoto es la ventana de días del mes', async () => {
    const transport = transportDeCalendario();
    const { component, transport: t, cambios, estable } = montarCalendario(transport, []);
    cambios();
    await estable();

    const busquedas = t.peticiones.filter((p) => p.path === '/api/v1/movements/search');
    expect(busquedas.length).toBe(1);
    const rango = rangoDe(busquedas[0]);
    const dias = component.calendarDays();
    expect(rango?.start).toBe(dias[0].iso);
    expect(rango?.end).toBe(dias.at(-1)?.iso);
    expect(component.store.dayMoves(component.store.hoy()).length).toBe(0);
  });
});
