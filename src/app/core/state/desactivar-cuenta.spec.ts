import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ApiCard } from '@core/api/cards.api';
import { AccountsCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-desactivar-cuenta', template: '' })
class ComponenteVacio {
  readonly comandos = inject(AccountsCommands);
}

const tarjetaCruda: ApiCard = {
  id: 'tarjeta-1',
  name: 'Visa',
  currency: 'COP',
  creditLimit: { amount: '5000000', currency: 'COP' },
  cycle: { statementDay: 10, paymentDueDay: 25 },
  terms: { purchaseApr: { rate: '0.3' }, dualCurrency: false },
  issuer: null,
  lastFour: '1234',
  isActive: true,
  createdAt: '2026-01-01',
  issuerEntity: { id: 'emisor-1', name: 'Banco' },
};

describe('AccountsCommands.desactivar', () => {
  it('una cuenta se desactiva con un solo PUT, conserva sus datos y sale del store', async () => {
    const transport = new TransportFalso().responder('PUT /api/v1/accounts/cuenta-1', { body: {} });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      transport,
      data: datosDe({
        accounts: [
          {
            id: 'cuenta-1',
            name: 'Ahorros',
            type: 'savings',
            currency: 'COP',
            openingBalance: 0,
            lastFour: '9876',
            institution: 'Banco',
            issuerId: 'emisor-1',
          },
        ],
      }),
    });
    cambios();

    await component.comandos.desactivar(store.account('cuenta-1')!);

    expect(transport.peticiones).toHaveLength(1);
    expect(transport.peticiones[0]).toMatchObject({
      method: 'PUT',
      path: '/api/v1/accounts/cuenta-1',
      body: {
        name: 'Ahorros',
        institution: 'Banco',
        lastFour: '9876',
        isDefault: false,
        isActive: false,
        issuerEntity: 'emisor-1',
      },
    });
    expect(store.account('cuenta-1')).toBeUndefined();
  });

  it('una tarjeta se desactiva con los terminos que ya conoce el store, sin descargar la lista', async () => {
    const transport = new TransportFalso().responder('PUT /api/v1/cards/tarjeta-1', { body: {} });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      transport,
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5_000_000 },
        ],
      }),
    });
    store.tarjetasCrudas.set([tarjetaCruda]);
    cambios();

    await component.comandos.desactivar(store.account('tarjeta-1')!);

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual(['PUT /api/v1/cards/tarjeta-1']);
    expect(transport.peticiones[0].body).toMatchObject({
      name: 'Visa',
      creditLimit: { amount: '5000000', currency: 'COP' },
      cycle: { statementDay: 10, paymentDueDay: 25 },
      terms: { purchaseApr: { rate: '0.3' }, dualCurrency: false },
      lastFour: '1234',
      isActive: false,
      issuerEntity: 'emisor-1',
    });
    expect(store.account('tarjeta-1')).toBeUndefined();
  });

  it('una tarjeta que el store no conoce falla sin tocar la API', async () => {
    const transport = new TransportFalso();
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      transport,
      data: datosDe({
        accounts: [{ id: 'tarjeta-2', name: 'MC', type: 'credit', currency: 'COP', openingBalance: 0, limit: 1 }],
      }),
    });
    cambios();

    await expect(component.comandos.desactivar(store.account('tarjeta-2')!)).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
    expect(store.account('tarjeta-2')).toBeDefined();
  });
});
