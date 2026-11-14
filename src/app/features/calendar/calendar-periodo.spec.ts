import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const recurrente = (id: string, name: string, materializadas: string[] = []) => ({
  id,
  name,
  kind: 2,
  movementTemplate: null,
  amount: { amount: '100000', currency: 'COP' },
  target: {},
  sourceAccount: null,
  destinationAccount: null,
  schedule: { frequency: 3, interval: 1, start: '2026-01-05', end: null, dayOfMonth: 5, dayOfWeek: null },
  isActive: true,
  nextOccurrence: null,
  materializedOccurrences: materializadas,
  createdAt: '2026-01-01T00:00:00Z',
});

const ocurrencia = (id: string, name: string, fecha: string) => ({
  recurrence: { id, name },
  occurrence: fecha,
  amount: { amount: '100000', currency: 'COP' },
  kind: 2,
});

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

async function montar() {
  const transport = new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder('GET /api/v1/recurrences/inactive', { body: [] })
    .responder('GET /api/v1/recurrences', {
      body: [
        recurrente('a', 'Arriendo'),
        recurrente('b', 'Seguro anual'),
        recurrente('c', 'Gimnasio', ['2026-11-03']),
        recurrente('d', 'Matrícula'),
      ],
    })
    .responder('GET /api/v1/calendar/projected', {
      body: [
        ocurrencia('a', 'Arriendo', '2026-11-20'),
        ocurrencia('a', 'Arriendo', '2026-12-20'),
        ocurrencia('b', 'Seguro anual', '2026-12-02'),
        ocurrencia('d', 'Matrícula', '2027-02-01'),
      ],
    });
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(P.calendario.ver, P.calendario.recurrencias.listar),
    data: datosDe(),
    providers: proveedores,
    transport,
  });
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return { ...montado, transport };
}

const nombres = (raiz: HTMLElement, selector: string) =>
  [...raiz.querySelectorAll(selector)].map((nodo) => nodo.textContent?.trim() ?? '');

const compromisos = (raiz: HTMLElement, grupo: string) =>
  nombres(raiz, `[data-tour="${grupo}"] [data-slot="agenda-item"] span`).map((texto) => texto.replace(/\s+/g, ' '));

describe('calendario, recurrentes y compromisos según el periodo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('en el mes lista solo los recurrentes con algo en ese mes, también los ya registrados', async () => {
    const { fixture } = await montar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(nombres(raiz, '[data-tour="calendario-recurrentes"] li b.truncate')).toEqual(['Arriendo', 'Gimnasio']);
  });

  it('en el mes separa lo pendiente de este mes de los compromisos del mes siguiente', async () => {
    const { fixture } = await montar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(compromisos(raiz, 'calendario-pendientes')).toEqual(['20 de nov · Arriendo · proyectado']);
    expect(compromisos(raiz, 'calendario-proximos')).toEqual([
      '2 de dic · Seguro anual · proyectado',
      '20 de dic · Arriendo · proyectado',
    ]);
  });

  it('en el día muestra solo lo de ese día y como próximo lo del día siguiente', async () => {
    const { fixture, component, cambios, estable } = await montar();

    component.setCalendarView('day');
    component.irAFecha('2026-12-01');
    cambios();
    await estable();
    cambios();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-tour="calendario-recurrentes"]')).toBeNull();
    expect(compromisos(raiz, 'calendario-proximos')).toEqual(['2 de dic · Seguro anual · proyectado']);
  });

  it('en el año lista los recurrentes del año y como próximos los del año siguiente', async () => {
    const { fixture, component, cambios, estable } = await montar();

    component.setCalendarView('year');
    cambios();
    await estable();
    cambios();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(nombres(raiz, '[data-tour="calendario-recurrentes"] li b.truncate')).toEqual([
      'Arriendo',
      'Seguro anual',
      'Gimnasio',
    ]);
    expect(compromisos(raiz, 'calendario-proximos')).toEqual(['1 de feb · Matrícula · proyectado']);
  });

  it('pide a la API las proyecciones del periodo visible y del siguiente', async () => {
    const { transport } = await montar();

    const peticion = transport.peticiones.filter((p) => p.path === '/api/v1/calendar/projected').at(-1);
    expect(peticion?.params).toEqual({ from: '2026-11-01', to: '2026-12-31' });
  });
});
