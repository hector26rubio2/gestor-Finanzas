import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { InspectorComponent } from './inspector';

const INVERSION = {
  id: 'inv-1',
  name: 'CDT',
  type: 'CDT',
  cost: 1_000_000,
  value: 1_100_000,
  currency: 'COP',
  units: 0,
  netContributions: 1_000_000,
  sinValoracion: false,
};

const OPERACIONES = [
  {
    movement: 'm1',
    type: 1,
    date: '2026-09-10',
    amount: { amount: '1000000', currency: 'COP' },
    quantity: null,
    unitPrice: null,
  },
  {
    movement: 'm2',
    type: 1,
    date: '2026-09-11',
    amount: { amount: '200000', currency: 'COP' },
    quantity: null,
    unitPrice: null,
    reversedBy: 'm2-reverso',
  },
];

const VALORIZACIONES = [
  { id: 'v1', date: '2026-09-20', value: { amount: '1100000', currency: 'COP' }, source: 3, reference: null },
  {
    id: 'v2',
    date: '2026-09-25',
    value: { amount: '900000', currency: 'COP' },
    source: 3,
    reference: null,
    voided: true,
  },
];

async function montar(permisos: string[]) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/investments/inv-1/operations', { body: OPERACIONES })
    .responder('GET /api/v1/investments/inv-1/valuations', { body: VALORIZACIONES })
    .responder('POST /api/v1/investments/inv-1/operations/m1/reverse', {
      body: { ...OPERACIONES[0], reversedBy: 'm1-reverso' },
    })
    .responder('POST /api/v1/investments/inv-1/valuations/v1/void', { body: { ...VALORIZACIONES[0], voided: true } });
  const montado = pruebaRender(InspectorComponent, {
    session: sesionDe().conCapacidad(P.patrimonio.ver, ...permisos),
    data: datosDe({ investments: [INVERSION] as never }),
    providers: [provideRouter([{ path: '**', children: [] }]) as unknown as Provider],
    transport,
  });
  montado.store.inspector.set({ type: 'investment', id: 'inv-1' });
  montado.cambios();
  await montado.estable();
  await new Promise((listo) => setTimeout(listo));
  montado.cambios();
  return { ...montado, transport };
}

const botones = (testid: string) => [...document.body.querySelectorAll<HTMLButtonElement>(`[data-testid="${testid}"]`)];

describe('inspector de inversión: reversar operaciones y anular valorizaciones', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container *').forEach((nodo) => nodo.remove());
  });

  it('quien puede editar ve «Reversar» solo en la operación que no está reversada', async () => {
    await montar([P.patrimonio.inversiones.editar]);

    expect(botones('reversar-operacion')).toHaveLength(1);
  });

  it('la operación reversada se muestra marcada y tachada, sin botón', async () => {
    await montar([P.patrimonio.inversiones.editar]);

    const marcada = document.body.querySelector('[data-reversada="true"]');

    expect(marcada).not.toBeNull();
    expect(marcada!.querySelector('button')).toBeNull();
    expect(marcada!.querySelector('.line-through')).not.toBeNull();
  });

  it('la valorización anulada se muestra marcada y solo la vigente ofrece «Anular»', async () => {
    await montar([P.patrimonio.inversiones.editar]);

    expect(document.body.querySelector('[data-anulada="true"]')).not.toBeNull();
    expect(botones('anular-valorizacion')).toHaveLength(1);
  });

  it('quien solo mira no ve ningún botón de reversar ni de anular', async () => {
    await montar([]);

    expect(botones('reversar-operacion')).toHaveLength(0);
    expect(botones('anular-valorizacion')).toHaveLength(0);
  });

  it('reversar pide confirmación y no llama al servidor hasta confirmar', async () => {
    const { cambios, transport, component } = await montar([P.patrimonio.inversiones.editar]);

    botones('reversar-operacion')[0].click();
    cambios();

    expect(component.pendingConfirm()?.kind).toBe('reverseInvestmentOperation');
    expect(transport.peticiones.some((p) => JSON.stringify(p).includes('/reverse'))).toBe(false);
  });

  it('confirmar reversa la operación en el servidor con la fecha de hoy o posterior y deja abierto el inspector', async () => {
    const { cambios, transport, component, store } = await montar([P.patrimonio.inversiones.editar]);
    botones('reversar-operacion')[0].click();
    cambios();

    component.confirmPending();
    await new Promise((listo) => setTimeout(listo));

    const llamada = transport.peticiones.find((p) => JSON.stringify(p).includes('/operations/m1/reverse'));
    expect(llamada).toBeDefined();
    expect(JSON.stringify(llamada)).toMatch(/"date":"\d{4}-\d{2}-\d{2}"/);
    expect(store.inspector()).toEqual({ type: 'investment', id: 'inv-1' });
  });

  it('cancelar la confirmación no reversa nada y devuelve el inspector', async () => {
    const { cambios, transport, component, store } = await montar([P.patrimonio.inversiones.editar]);
    botones('reversar-operacion')[0].click();
    cambios();

    component.dismissPending();

    expect(transport.peticiones.some((p) => JSON.stringify(p).includes('/reverse'))).toBe(false);
    expect(store.inspector()).toEqual({ type: 'investment', id: 'inv-1' });
  });

  it('confirmar la anulación llama al servidor', async () => {
    const { cambios, transport, component } = await montar([P.patrimonio.inversiones.editar]);
    botones('anular-valorizacion')[0].click();
    cambios();

    component.confirmPending();
    await new Promise((listo) => setTimeout(listo));

    expect(transport.peticiones.some((p) => JSON.stringify(p).includes('/valuations/v1/void'))).toBe(true);
  });
});
