import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const VISA = {
  id: 'visa',
  name: 'Visa Oro',
  type: 'credit' as const,
  currency: 'COP',
  openingBalance: 0,
  cutDay: 15,
  dueDay: 5,
};

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

async function montar() {
  const transport = new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder('GET /api/v1/recurrences/inactive', { body: [] })
    .responder('GET /api/v1/recurrences', { body: [] })
    .responder('GET /api/v1/calendar/projected', { body: [] });
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(P.calendario.ver, P.calendario.recurrencias.listar),
    data: datosDe({ accounts: [VISA] }),
    providers: proveedores,
    transport,
  });
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return montado;
}

const celda = (raiz: HTMLElement, dia: string) =>
  [...raiz.querySelectorAll<HTMLElement>('[data-slot="calendar-day"]')].find(
    (boton) => boton.querySelector('b')?.textContent?.trim() === dia && !boton.className.includes('text-muted'),
  );

describe('calendario, corte y pago de las tarjetas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('en el mes cada día muestra el corte o el pago de la tarjeta', async () => {
    const { fixture } = await montar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(celda(raiz, '15')?.textContent).toContain('Corte · Visa Oro');
    expect(celda(raiz, '5')?.textContent).toContain('Pago · Visa Oro');
    expect(celda(raiz, '10')?.textContent).not.toContain('Visa Oro');
  });

  it('en el día el corte es un botón que lleva a la tarjeta', async () => {
    const { fixture, component, store, cambios, estable } = await montar();
    const inspeccionar = vi.spyOn(store, 'inspect');

    component.setCalendarView('day');
    component.irAFecha('2026-11-15');
    cambios();
    await estable();
    cambios();

    const raiz = fixture.nativeElement as HTMLElement;
    const boton = raiz.querySelector<HTMLElement>('[data-slot="calendar-card-date"]');
    expect(boton?.textContent?.trim()).toBe('Corte · Visa Oro');
    boton!.click();
    expect(inspeccionar).toHaveBeenCalledWith('account', 'visa');
  });
});
