import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { AppStore, PeopleCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-abono-de-deuda', template: '' })
class ComponenteVacio {
  readonly comandos = inject(PeopleCommands);
  readonly store = inject(AppStore);
}

const pago = {
  obligation: { id: 'deuda-1' },
  movement: {
    id: 'mov-pago',
    date: '2026-11-18',
    kind: 6,
    effect: 2,
    flow: 1,
    amount: {
      original: { amount: '50000', currency: 'COP' },
      base: { amount: '50000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-11-18',
    },
    links: { account: 'cuenta-1', obligation: 'deuda-1' },
    linkNames: {},
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    description: 'Abono',
    origin: 1,
    createdAt: '2026-11-18T10:00:00Z',
  },
};

const solicitud = {
  obligationId: 'deuda-1',
  date: '2026-11-18',
  amount: 50000,
  currency: 'COP',
  accountId: 'cuenta-1',
};

function montar(capacidades: string[], transport = new TransportFalso()) {
  const montado = pruebaRender(ComponenteVacio, {
    transport,
    session: capacidades.length ? sesionDe().conCapacidad(...capacidades) : sesionDe().sinCapacidades(),
    data: datosDe(),
  });
  montado.cambios();
  return { ...montado, transport };
}

describe('PeopleCommands.abonarDeuda', () => {
  it('registra el abono con una sola petición y suma el movimiento al libro', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/obligations/deuda-1/payments', { body: pago });
    const { component } = montar([P.movimientos.pagos.crear], transport);

    await component.comandos.abonarDeuda({ ...solicitud, note: 'Cuota de noviembre' });

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual([
      'POST /api/v1/obligations/deuda-1/payments',
    ]);
    expect(transport.peticiones[0].body).toMatchObject({
      date: '2026-11-18',
      amount: { amount: '50000', currency: 'COP' },
      account: 'cuenta-1',
      note: 'Cuota de noviembre',
    });
    expect((transport.peticiones[0].body as { idempotencyKey: string }).idempotencyKey).toBeTruthy();
    expect(component.store.data().movements.some((m) => m.id === 'mov-pago')).toBe(true);
  });

  it('sin permiso de pagos ni de crear movimientos no toca la API', async () => {
    const { component, transport } = montar([]);

    await expect(component.comandos.abonarDeuda(solicitud)).rejects.toThrow();
    expect(transport.peticiones).toEqual([]);
  });

  it('un importe cero o negativo se rechaza sin llamar a la API', async () => {
    const { component, transport } = montar([P.movimientos.pagos.crear]);

    await expect(component.comandos.abonarDeuda({ ...solicitud, amount: 0 })).rejects.toThrow();
    await expect(component.comandos.abonarDeuda({ ...solicitud, amount: -5 })).rejects.toThrow();
    expect(transport.peticiones).toEqual([]);
  });
});
