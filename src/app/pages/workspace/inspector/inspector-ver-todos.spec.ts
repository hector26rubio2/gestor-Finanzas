import { type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { InspectorComponent } from './inspector';

const AHORROS = { id: 'ahorros', name: 'Ahorros', type: 'savings' as const, currency: 'COP', openingBalance: 500_000 };

async function montarConDetalleDeCuenta() {
  const transport = new TransportFalso().responder(/^POST \/api\/v1\/movements\/search/, {
    body: { items: [], page: 1, size: 8, total: 0, totalPages: 0, hasNext: false },
  });
  const montado = pruebaRender(InspectorComponent, {
    session: sesionDe().conCapacidad(P.cuentas.ver, P.movimientos.ver),
    data: datosDe({ accounts: [AHORROS] }),
    providers: [provideRouter([{ path: '**', children: [] }]) as unknown as Provider],
    transport,
  });
  montado.store.inspector.set({ type: 'account', id: 'ahorros' });
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return montado;
}

const verTodos = () =>
  [...document.body.querySelectorAll<HTMLElement>('section button, section a')].find((nodo) =>
    /Ver todos/.test(nodo.textContent ?? ''),
  );

describe('detalle de cuenta, «Ver todos»', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container *').forEach((nodo) => nodo.remove());
  });

  it('lleva a Movimientos con la cuenta en la URL, desde cualquier pantalla', async () => {
    const { store, cambios, estable } = await montarConDetalleDeCuenta();

    verTodos()!.click();
    cambios();
    await estable();

    expect(TestBed.inject(Router).url).toBe('/movements?cuenta=ahorros');
    expect(store.inspector()).toBeNull();
  });
});
