import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';
import { InspectorInversion } from './inspector-inversion';

const inversion = signal<string | undefined>(undefined);

@Component({ selector: 'prueba-inspector-inversion', template: '' })
class ComponenteInversion {
  readonly historial = new InspectorInversion(() => inversion());
}

const operaciones = [
  {
    movement: 'm1',
    type: 1,
    date: '2026-10-02',
    amount: { amount: '500', currency: 'USD' },
    quantity: null,
    unitPrice: null,
  },
  {
    movement: null,
    type: 3,
    date: '2026-10-01',
    amount: { amount: '300', currency: 'USD' },
    quantity: '3',
    unitPrice: null,
  },
];
const valorizaciones = [
  { id: 'v1', date: '2026-10-05', value: { amount: '900', currency: 'USD' }, source: 3, reference: null },
];

async function esperar() {
  await new Promise((listo) => setTimeout(listo));
}

describe('InspectorInversion', () => {
  it('trae operaciones y valorizaciones de la inversión abierta', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/investments/inv-1/operations', { body: operaciones })
      .responder('GET /api/v1/investments/inv-1/valuations', { body: valorizaciones });
    inversion.set('inv-1');
    const { component, cambios } = pruebaRender(ComponenteInversion, { data: datosDe(), transport });
    cambios();
    await esperar();

    expect(component.historial.operaciones()?.map((o) => o.type)).toEqual([1, 3]);
    expect(component.historial.valorizaciones()?.map((v) => v.id)).toEqual(['v1']);
    expect(component.historial.fallo()).toBe(false);
  });

  it('si el historial falla marca el fallo y no lanza', async () => {
    const transport = new TransportFalso().responder('GET /api/v1/investments/inv-2/operations', {
      error: { status: 500 },
    });
    inversion.set('inv-2');
    const { component, cambios } = pruebaRender(ComponenteInversion, { data: datosDe(), transport });
    cambios();
    await esperar();

    expect(component.historial.fallo()).toBe(true);
    expect(component.historial.operaciones()).toBeNull();
  });

  it('sin inversión abierta no pide nada', async () => {
    const transport = new TransportFalso();
    inversion.set(undefined);
    const { component, cambios } = pruebaRender(ComponenteInversion, { data: datosDe(), transport });
    cambios();
    await esperar();

    expect(transport.peticiones).toHaveLength(0);
    expect(component.historial.operaciones()).toBeNull();
  });
});
