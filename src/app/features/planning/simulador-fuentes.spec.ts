import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ApiWritesBus } from '@core/api';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { FuentesDelSimulador } from './simulador-fuentes';

@Component({
  selector: 'prueba-fuentes-simulador',
  template: '',
  providers: [FuentesDelSimulador],
})
class HostFuentes {
  readonly fuentes = inject(FuentesDelSimulador);
}

const obligacion = (id: string, total: string) => ({
  id,
  direction: 2,
  status: 1,
  counterparty: { id: `cp-${id}`, name: `Acreedor ${id}` },
  description: `Obligación ${id}`,
  totalOutstanding: { amount: total, currency: 'COP' },
  interestPolicies: [{ policy: { kind: 1, period: 2, rate: { rate: 24 } } }],
  openedOn: '2026-01-10',
  dueOn: '2027-01-10',
});

describe('simulador: fuentes de deudas y flujos', () => {
  function montar(opciones: {
    transport: TransportFalso;
    session?: ReturnType<typeof sesionDe>;
    data?: ReturnType<typeof datosDe>;
  }) {
    return pruebaRender(HostFuentes, { ...opciones }) as {
      component: HostFuentes;
      estable(): Promise<void>;
      cambios(): unknown;
    };
  }

  it('trae los movimientos de las tarjetas de crédito y los usa como fuente', async () => {
    const transport = new TransportFalso().responder(/^POST \/api\/v1\/movements\/search/, {
      body: { items: [], hasNext: false },
    });
    const { component, estable } = montar({
      transport,
      session: sesionDe().sinCapacidades(),
      data: datosDe({
        accounts: [{ id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 }],
      }),
    });
    expect(component.fuentes.movimientosDeTarjetas()).toBeNull();

    await estable();
    expect(component.fuentes.movimientosDeTarjetas()).toEqual([]);
    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toContain('POST /api/v1/movements/search');
  });

  it('sin tarjetas de crédito no llama al API por movimientos', async () => {
    const transport = new TransportFalso();
    const { component, estable } = montar({ transport, session: sesionDe().sinCapacidades(), data: datosDe() });

    await estable();
    expect(component.fuentes.movimientosDeTarjetas()).toEqual([]);
    expect(transport.peticiones).toEqual([]);
  });

  it('trae obligaciones y recurrentes solo con el permiso correspondiente', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/obligations', { body: [obligacion('o1', '3000000') as never] })
      .responder('GET /api/v1/recurrences', { body: [] });

    const { component, estable } = montar({
      transport,
      session: sesionDe().conCapacidad(P.personas.obligaciones.listar, P.calendario.recurrencias.listar),
      data: datosDe(),
    });

    await estable();
    expect(component.fuentes.obligaciones().map((o) => o.id)).toEqual(['o1']);
    expect(component.fuentes.recurrentesApi()).toEqual([]);
    const rutas = transport.peticiones.map((p) => p.path);
    expect(rutas).toContain('/api/v1/obligations');
    expect(rutas).toContain('/api/v1/recurrences');
  });

  it('sin permiso no pide obligaciones ni recurrentes, aunque la sesión esté lista', async () => {
    const transport = new TransportFalso();
    const { component, estable } = montar({ transport, session: sesionDe().sinCapacidades(), data: datosDe() });

    await estable();
    expect(transport.peticiones).toEqual([]);
    expect(component.fuentes.obligaciones()).toEqual([]);
    expect(component.fuentes.recurrentesApi()).toEqual([]);
  });

  it('un fallo del API deja la fuente vacía en vez de romper el simulador', async () => {
    const transport = new TransportFalso().responder(/^GET \/api\/v1\//, {
      error: { status: 500, code: 'server.error' },
    });
    const { component, estable } = montar({
      transport,
      session: sesionDe().conCapacidad(P.personas.obligaciones.listar),
      data: datosDe({
        accounts: [{ id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 }],
      }),
    });

    await estable();
    expect(component.fuentes.movimientosDeTarjetas()).toBeNull();
    expect(component.fuentes.obligaciones()).toEqual([]);
  });

  it('una escritura en el API vuelve a pedir obligaciones y movimientos', async () => {
    const transport = new TransportFalso()
      .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
      .responder('GET /api/v1/obligations', { body: [] });
    const { estable } = montar({
      transport,
      session: sesionDe().conCapacidad(P.personas.obligaciones.listar),
      data: datosDe(),
    });
    await estable();
    expect(transport.peticiones.filter((p) => p.path === '/api/v1/obligations')).toHaveLength(1);

    TestBed.inject(ApiWritesBus).notify();
    await estable();

    expect(transport.peticiones.filter((p) => p.path === '/api/v1/obligations')).toHaveLength(2);
  });
});
