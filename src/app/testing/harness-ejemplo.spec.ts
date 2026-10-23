import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppStore, CatalogCommands } from '@core/state';
import { describe, expect, it } from 'vitest';
import { datosDe } from './datos-de-prueba';
import { pruebaRender } from './prueba-render';
import { sesionDe } from './sesion-de-prueba';
import { TransportFalso } from './transport-falso';

@Component({
  selector: 'prueba-tarjeta-harness',
  template: '<span>{{ store.data().accounts[0].name }}</span>',
})
class ComponenteTarjeta {
  readonly store = inject(AppStore);
}

/**
 * Spec de ejemplo: demuestra el harness de principio a fin para que los
 * tickets 02-05 copien este patrón.
 */
describe('harness-de-prueba (ejemplo)', () => {
  it('siembra el store, corre un comando contra el transport falso y asserts el estado', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/accounts', {
      body: { id: 'cuenta-nueva', name: 'Corriente', currency: 'COP', lastFour: '4321' },
    });

    const { store, cambios } = pruebaRender(ComponenteTarjeta, {
      session: sesionDe().conCapacidad('cuentas.crear'),
      data: datosDe(),
      transport,
    });
    cambios();

    expect(store.user()?.capabilities).toContain('cuentas.crear');
    expect(store.data().accounts.map((a) => a.name)).toEqual(['Ahorros', 'Efectivo']);

    await TestBed.inject(CatalogCommands).createAccount('Corriente', 'checking', 0, 'COP');

    expect(transport.peticiones).toEqual([
      {
        method: 'POST',
        path: '/api/v1/accounts',
        body: { name: 'Corriente', kind: 2, currency: 'COP', lastFour: null, issuerEntity: null },
      },
    ]);
    expect(store.data().accounts).toContainEqual({
      id: 'cuenta-nueva',
      name: 'Corriente',
      type: 'checking',
      currency: 'COP',
      openingBalance: 0,
      lastFour: '4321',
      issuerId: undefined,
    });
  });
});
