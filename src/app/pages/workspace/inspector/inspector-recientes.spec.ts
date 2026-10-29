import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { Account } from '@core/state';
import { CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';
import { CANTIDAD_DE_RECIENTES, InspectorRecientes } from './inspector-recientes';

const cuenta = signal<Account | undefined>(undefined);

@Component({ selector: 'prueba-recientes', template: '' })
class ComponenteRecientes {
  readonly recientes = new InspectorRecientes(() => cuenta());
}

const pagina = {
  body: {
    items: [
      {
        id: 'saldo-inicial',
        date: '2026-10-28',
        kind: MovementKind.income,
        effect: EconomicEffect.income,
        flow: CashFlow.inflow,
        amount: {
          original: { amount: '2000000', currency: 'COP' },
          base: { amount: '2000000', currency: 'COP' },
          rate: '1',
          rateAsOf: '2026-10-28',
        },
        cardBucket: null,
        purchaseApr: null,
        description: 'Saldo inicial',
        links: { account: 'ahorros' },
        linkNames: {},
      },
    ],
    page: 1,
    size: CANTIDAD_DE_RECIENTES,
    total: 1,
    totalPages: 1,
    hasNext: false,
    nextCursor: null,
  },
};

describe('InspectorRecientes', () => {
  it('trae los últimos movimientos de una cuenta de ahorros filtrando por cuenta', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements/search', pagina);
    cuenta.set({ id: 'ahorros', name: 'Ahorros', type: 'savings', currency: 'COP' } as Account);
    const { component, cambios } = pruebaRender(ComponenteRecientes, { data: datosDe(), transport });
    cambios();
    await new Promise((listo) => setTimeout(listo));

    const pedido = transport.peticiones.find((p) => p.path.includes('movements/search'))!;
    expect((pedido.body as { filter: { accounts?: string[] } }).filter.accounts).toEqual(['ahorros']);
    expect((pedido.body as { page: { size: number } }).page.size).toBe(CANTIDAD_DE_RECIENTES);
    expect(component.recientes.movimientos().map((m) => m.description)).toEqual(['Saldo inicial']);
  });

  it('en una tarjeta filtra por tarjeta', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements/search', pagina);
    cuenta.set({ id: 'visa', name: 'Visa', type: 'credit', currency: 'COP' } as Account);
    const { cambios } = pruebaRender(ComponenteRecientes, { data: datosDe(), transport });
    cambios();
    await new Promise((listo) => setTimeout(listo));

    const pedido = transport.peticiones.find((p) => p.path.includes('movements/search'))!;
    expect((pedido.body as { filter: { cards?: string[] } }).filter.cards).toEqual(['visa']);
  });
});
