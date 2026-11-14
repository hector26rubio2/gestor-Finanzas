import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const RECURRENTE = {
  id: 'rec-1',
  name: 'Arriendo',
  kind: 2,
  movementTemplate: null,
  amount: { amount: '900000', currency: 'COP' },
  target: {},
  sourceAccount: null,
  destinationAccount: null,
  schedule: { frequency: 3, interval: 1, start: '2026-01-05', end: null, dayOfMonth: 5, dayOfWeek: null },
  isActive: true,
  nextOccurrence: '2026-12-05',
  materializedOccurrences: [],
  createdAt: '2026-01-01T00:00:00Z',
};

function hoyIso(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

describe('calendario, desactivar un recurrente', () => {
  it('el botón dice Desactivar', async () => {
    const transport = new TransportFalso()
      .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
      .responder('GET /api/v1/calendar/projected', {
        body: [
          {
            recurrence: { id: RECURRENTE.id, name: RECURRENTE.name },
            occurrence: hoyIso(),
            amount: RECURRENTE.amount,
            kind: 2,
          },
        ],
      })
      .responder('GET /api/v1/recurrences/inactive', { body: [] })
      .responder('GET /api/v1/recurrences', { body: [RECURRENTE] });
    const { fixture, cambios, estable } = pruebaRender(CalendarTabComponent, {
      session: sesionDe().conCapacidad(
        P.calendario.ver,
        P.calendario.recurrencias.listar,
        P.calendario.recurrencias.deshabilitar,
      ),
      data: datosDe(),
      providers: proveedores,
      transport,
    });
    cambios();
    await estable();
    cambios();

    const boton = fixture.nativeElement.querySelector('[data-tour="calendario-eliminar"]') as HTMLElement;
    expect(boton.textContent?.trim()).toBe('Desactivar');
    expect(boton.getAttribute('aria-label')).toBe('Desactivar el recurrente Arriendo');
  });
});
