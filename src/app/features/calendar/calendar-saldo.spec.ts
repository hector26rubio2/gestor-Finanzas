import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { P } from '@core/session';
import { MovementKind } from '@core/utils/movement-kinds';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const EFECTIVO = {
  id: 'efectivo',
  name: 'Efectivo',
  type: 'cash' as const,
  currency: 'COP',
  openingBalance: 1_000_000,
};

const ARRIENDO = {
  id: 'rec-a',
  name: 'Arriendo',
  kind: 1,
  movementTemplate: MovementKind.expense,
  amount: { amount: '300000', currency: 'COP' },
  target: {},
  sourceAccount: null,
  destinationAccount: null,
  schedule: { frequency: 3, interval: 1, start: '2026-01-20', end: null, dayOfMonth: 20, dayOfWeek: null },
  isActive: true,
  nextOccurrence: '2026-11-20',
  materializedOccurrences: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

async function montar() {
  const transport = new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder('GET /api/v1/recurrences/inactive', { body: [] })
    .responder('GET /api/v1/recurrences', { body: [ARRIENDO] })
    .responder('GET /api/v1/calendar/projected', {
      body: [
        {
          recurrence: { id: 'rec-a', name: 'Arriendo' },
          occurrence: '2026-11-20',
          amount: ARRIENDO.amount,
          kind: 1,
        },
      ],
    });
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(P.calendario.ver, P.calendario.recurrencias.listar),
    data: datosDe({ accounts: [EFECTIVO] }),
    providers: proveedores,
    transport,
  });
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return { ...montado, transport };
}

const saldoDe = (raiz: HTMLElement, dia: string) =>
  [...raiz.querySelectorAll<HTMLElement>('[data-slot="calendar-day"]')]
    .find((boton) => boton.querySelector('b')?.textContent?.trim() === dia && !boton.className.includes('text-muted'))
    ?.querySelector('[data-slot="calendar-balance"]')
    ?.getAttribute('title')
    ?.replace(/\s+/g, ' ')
    .trim();

describe('calendario, saldo proyectado día a día', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('desde hoy cada día muestra el disponible previsto y baja el día del recurrente', async () => {
    const { fixture } = await montar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(saldoDe(raiz, '9')).toContain('1.000.000');
    expect(saldoDe(raiz, '19')).toContain('1.000.000');
    expect(saldoDe(raiz, '20')).toContain('700.000');
    expect(saldoDe(raiz, '30')).toContain('700.000');
  });

  it('en la celda el saldo va compacto para que quepa', async () => {
    const { fixture } = await montar();

    const celda = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="calendar-balance"]');
    expect(celda?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^1\sM$/);
  });

  it('un saldo previsto de cero también se muestra', async () => {
    const { fixture, store, cambios } = await montar();
    store.data.update((datos) => ({ ...datos, accounts: [{ ...EFECTIVO, openingBalance: 300_000 }] }));
    cambios();

    expect(saldoDe(fixture.nativeElement as HTMLElement, '20')).toMatch(/(^|\D)0(\D|$)/);
  });

  it('los días pasados no muestran saldo proyectado', async () => {
    const { fixture } = await montar();

    expect(saldoDe(fixture.nativeElement as HTMLElement, '5')).toBeUndefined();
  });

  it('al ver un mes futuro pide las proyecciones desde hoy para acumular bien', async () => {
    const { component, transport, cambios, estable } = await montar();

    component.shiftCalendar(1);
    cambios();
    await estable();

    const peticion = transport.peticiones.filter((p) => p.path === '/api/v1/calendar/projected').at(-1);
    expect(peticion?.params).toEqual({ from: '2026-11-09', to: '2027-01-31' });
  });
});
