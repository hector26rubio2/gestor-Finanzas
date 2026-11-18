import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ApiCard } from '@core/api/cards.api';
import { P } from '@core/session/permissions';
import { AppStore, CatalogCommands, type CondicionesDeTarjeta } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import type { Account } from './view-model';

@Component({ selector: 'prueba-editar-tarjeta', template: '' })
class ComponenteVacio {
  readonly comandos = inject(CatalogCommands);
  readonly store = inject(AppStore);
}

const dinero = (amount: string, currency = 'COP') => ({ amount, currency });

function tarjetaApi(moneda = 'COP'): ApiCard {
  return {
    id: 't1',
    name: 'Visa',
    currency: moneda,
    creditLimit: dinero('2000000', moneda),
    cycle: { statementDay: 10, paymentDueDay: 25 },
    terms: {
      purchaseApr: { rate: '0.30' },
      paymentPriority: [1, 2, 3],
      foreignPaymentPriority: [1, 2],
      monthlyFee: dinero('10000', moneda),
      dualCurrency: false,
      applyPaymentPriority: true,
    },
    issuer: null,
    lastFour: '9999',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  } as ApiCard;
}

const cuenta = (moneda = 'COP'): Account => ({
  id: 't1',
  name: 'Visa',
  type: 'credit',
  currency: moneda,
  openingBalance: 0,
  limit: 2000000,
  cutDay: 10,
  dueDay: 25,
  annualRate: 30,
  lastFour: '9999',
});

const condiciones = (cambios: Partial<CondicionesDeTarjeta> = {}): CondicionesDeTarjeta => ({
  limit: 2000000,
  cutDay: 10,
  dueDay: 25,
  monthlyRate: 2.11,
  ...cambios,
});

function montar(moneda = 'COP') {
  const transport = new TransportFalso()
    .responder('GET /api/v1/cards', { body: [tarjetaApi(moneda)] })
    .responder('PUT /api/v1/cards/t1', { body: tarjetaApi(moneda) });
  const montado = pruebaRender(ComponenteVacio, {
    transport,
    session: sesionDe().conCapacidad(P.cuentas.ver, P.cuentas.editar),
    data: datosDe({ accounts: [cuenta(moneda)] }),
  });
  montado.cambios();
  return { ...montado, transport };
}

async function guardar(cambios: Partial<CondicionesDeTarjeta>, moneda = 'COP') {
  const { component, transport, store } = montar(moneda);
  await component.comandos.updateAccount(cuenta(moneda), {
    name: 'Visa',
    lastFour: '9999',
    credit: condiciones(cambios),
  });
  const put = transport.peticiones.find((p) => p.method === 'PUT');
  return { cuerpo: put?.body as Record<string, any>, tarjeta: store.data().accounts.find((a) => a.id === 't1')! };
}

describe('editar una tarjeta: cada campo viaja a la API y se ve igual después', () => {
  it('el cupo', async () => {
    const { cuerpo, tarjeta } = await guardar({ limit: 3500000 });

    expect(cuerpo['creditLimit']).toEqual({ amount: '3500000', currency: 'COP' });
    expect(tarjeta.limit).toBe(3500000);
  });

  it('el día de corte y el de pago', async () => {
    const { cuerpo, tarjeta } = await guardar({ cutDay: 3, dueDay: 18 });

    expect(cuerpo['cycle']).toEqual({ statementDay: 3, paymentDueDay: 18 });
    expect([tarjeta.cutDay, tarjeta.dueDay]).toEqual([3, 18]);
  });

  it('la tasa mensual se guarda como anual en fracción y vuelve como porcentaje', async () => {
    const { cuerpo, tarjeta } = await guardar({ monthlyRate: 2 });

    expect(Number(cuerpo['terms'].purchaseApr.rate)).toBeCloseTo(0.2682, 3);
    expect(tarjeta.annualRate).toBeCloseTo(26.82, 1);
  });

  it('la prioridad de pago en pesos y en dólares', async () => {
    const { cuerpo, tarjeta } = await guardar({ paymentPriority: [3, 1, 2], foreignPaymentPriority: [2, 1] });

    expect(cuerpo['terms'].paymentPriority).toEqual([3, 1, 2]);
    expect(cuerpo['terms'].foreignPaymentPriority).toEqual([2, 1]);
    expect(tarjeta.paymentPriority).toEqual([3, 1, 2]);
    expect(tarjeta.foreignPaymentPriority).toEqual([2, 1]);
  });

  it('pagar por antigüedad en lugar de por prioridad', async () => {
    const { cuerpo, tarjeta } = await guardar({ applyPaymentPriority: false });

    expect(cuerpo['terms'].applyPaymentPriority).toBe(false);
    expect(tarjeta.applyPaymentPriority).toBe(false);
  });

  it('quitar la cuota de manejo la deja en nulo', async () => {
    const { cuerpo, tarjeta } = await guardar({ monthlyFee: 0 });

    expect(cuerpo['terms'].monthlyFee).toBeNull();
    expect(tarjeta.monthlyFee).toBeUndefined();
  });

  it('la cuota de manejo de una tarjeta en dólares se guarda en dólares', async () => {
    const { cuerpo } = await guardar({ monthlyFee: 12.5 }, 'USD');

    expect(cuerpo['terms'].monthlyFee).toEqual({ amount: '12.5', currency: 'USD' });
  });
});
