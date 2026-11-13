import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const DESACTIVADO = {
  id: 'rec-9',
  name: 'Gimnasio',
  kind: 2,
  movementTemplate: null,
  amount: { amount: '120000', currency: 'COP' },
  target: {},
  sourceAccount: null,
  destinationAccount: null,
  schedule: { frequency: 3, interval: 1, start: '2026-01-05', end: null, dayOfMonth: 5, dayOfWeek: null },
  isActive: false,
  nextOccurrence: null,
  materializedOccurrences: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

function transporteCon(desactivados: unknown) {
  return new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder('GET /api/v1/calendar/projected', { body: [] })
    .responder('GET /api/v1/recurrences', { body: [] })
    .responder('GET /api/v1/recurrences/inactive', desactivados as never);
}

async function montar(transport: TransportFalso, ...capacidades: string[]) {
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(P.calendario.ver, P.calendario.recurrencias.listar, ...capacidades),
    data: datosDe(),
    providers: proveedores,
    transport,
  });
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return montado;
}

const lista = (raiz: HTMLElement) => raiz.querySelector('[data-tour="calendario-desactivados"]');

describe('calendario, reactivar un recurrente', () => {
  it('lista los recurrentes desactivados con su botón Reactivar', async () => {
    const { fixture } = await montar(transporteCon({ body: [DESACTIVADO] }), P.calendario.recurrencias.deshabilitar);

    const raiz = fixture.nativeElement as HTMLElement;
    expect(lista(raiz)?.textContent).toContain('Gimnasio');
    const boton = raiz.querySelector('[data-tour="calendario-reactivar"]') as HTMLElement;
    expect(boton.textContent?.trim()).toBe('Reactivar');
    expect(boton.getAttribute('aria-label')).toBe('Reactivar el recurrente Gimnasio');
  });

  it('sin el permiso de deshabilitar se ven pero no se pueden reactivar', async () => {
    const { fixture } = await montar(transporteCon({ body: [DESACTIVADO] }));

    const raiz = fixture.nativeElement as HTMLElement;
    expect(lista(raiz)?.textContent).toContain('Gimnasio');
    expect(raiz.querySelector('[data-tour="calendario-reactivar"]')).toBeNull();
  });

  it('al reactivar llama a la API, avisa y recarga las listas', async () => {
    const transport = transporteCon({ body: [DESACTIVADO] }).responder('POST /api/v1/recurrences/rec-9/reactivation', {
      body: { ...DESACTIVADO, isActive: true },
    });
    const { fixture, store, cambios, estable } = await montar(transport, P.calendario.recurrencias.deshabilitar);
    transport
      .responder('GET /api/v1/recurrences', { body: [{ ...DESACTIVADO, isActive: true }] })
      .responder('GET /api/v1/recurrences/inactive', { body: [] });

    await fixture.componentInstance.reactivarRecurrente(DESACTIVADO);
    cambios();
    await estable();
    cambios();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(store.toast.texto()).toBe('Recurrente «Gimnasio» reactivado.');
    expect(lista(raiz)).toBeNull();
    expect(raiz.querySelector('[data-tour="calendario-recurrentes"]')?.textContent).toContain('Gimnasio');
  });

  it('si la API aún no ofrece la lista de desactivados, el calendario carga sin error', async () => {
    const { fixture, store } = await montar(transporteCon({ error: { status: 404, code: 'resource.not_found' } }));

    expect(lista(fixture.nativeElement as HTMLElement)).toBeNull();
    expect(store.toast.texto()).toBeFalsy();
  });
});
