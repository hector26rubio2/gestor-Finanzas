import { Component, type Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { ApiMovement } from '@core/api/api-client';
import { CARD_BUCKET } from '@core/api';
import { P } from '@core/session/permissions';
import type { Account, Movement } from '@core/state';
import { todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { InspectorCard } from './inspector-card';
import { InspectorComponent } from './inspector';

const TARJETA: Account = {
  id: 't1',
  name: 'Visa',
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  limit: 5_000_000,
  annualRate: 24,
  monthlyFee: 10_000,
};

const AHORROS: Account = {
  id: 'ahorros',
  name: 'Ahorros',
  type: 'savings',
  currency: 'COP',
  openingBalance: 5_000_000,
};

const dinero = (monto: number) => ({ amount: String(monto), currency: 'COP' });

const compra = (id: string, monto: number, extra: Partial<ApiMovement> = {}): ApiMovement => ({
  id,
  date: todayIso(),
  kind: 20,
  effect: 2,
  flow: 2,
  amount: { original: dinero(monto), base: dinero(monto), rate: '1', rateAsOf: todayIso() },
  links: { card: 't1' },
  linkNames: {},
  origin: 0,
  description: id,
  createdAt: '2026-10-05T12:00:00Z',
  reversalOf: null,
  reversedBy: null,
  purchaseApr: null,
  ...extra,
});

@Component({ selector: 'prueba-inspector-card-desglose', template: '' })
class Anfitrion {
  readonly cuenta = signal<Account | undefined>(undefined);
  readonly inspector = new InspectorCard(() => this.cuenta());
}

describe('abonar a la tarjeta envía el desglose que se vio', () => {
  it('cada parte aplicada viaja con su concepto y las que quedan en cero no', async () => {
    const transport = new TransportFalso()
      .responder(/^POST \/api\/v1\/movements\/search/, {
        body: { items: [compra('c1', 400_000)], hasNext: false },
      })
      .responder('POST /api/v1/operations/card-payments', {
        body: { id: 'op1', kind: 3, date: todayIso(), description: null, legs: [] },
      });
    const montado = pruebaRender(Anfitrion, {
      transport,
      session: sesionDe().conCapacidad(P.cuentas.ver, P.movimientos.ver, P.movimientos.pagos.crear),
      data: datosDe({ accounts: [TARJETA, AHORROS] }),
    });
    montado.component.cuenta.set(TARJETA);
    for (let i = 0; i < 3; i++) {
      montado.cambios();
      await montado.estable();
    }
    const inspector = montado.component.inspector;
    inspector.cardPaymentAmount.set(150_000);
    const esperado = inspector
      .paymentAllocation()
      .filter((fila) => fila.aplicado > 0)
      .map((fila) => ({ bucket: fila.concepto, aplicado: fila.aplicado }));
    expect(esperado.length).toBeGreaterThan(0);

    await inspector.confirmarAbono();

    const llamada = transport.peticiones.find((p) => JSON.stringify(p).includes('/operations/card-payments'));
    const cuerpo = (llamada as unknown as { body: { allocation: { bucket: number; amount: { amount: string } }[] } })
      .body;
    expect(cuerpo.allocation.map((parte) => parte.bucket)).toEqual(esperado.map((parte) => parte.bucket));
    expect(cuerpo.allocation.map((parte) => Number(parte.amount.amount))).toEqual(
      esperado.map((parte) => parte.aplicado),
    );
    expect(cuerpo.allocation.reduce((total, parte) => total + Number(parte.amount.amount), 0)).toBeLessThanOrEqual(
      150_000,
    );
  });
});

describe('detalle del pago: reparto por concepto', () => {
  const pago = (desglose?: Movement['desglose']): Movement =>
    ({
      id: 'p1',
      date: '2026-10-05',
      description: 'Abono a Visa',
      accountId: 't1',
      category: 'Pagos',
      kind: 'income',
      effect: 'neutral',
      amount: 150_000,
      status: 'confirmed',
      ...(desglose ? { desglose } : {}),
    }) as Movement;

  async function abrir(movimiento: Movement) {
    const montado = pruebaRender(InspectorComponent, {
      session: sesionDe().conCapacidad(P.cuentas.ver, P.movimientos.ver),
      data: datosDe({ accounts: [TARJETA, AHORROS], movements: [movimiento] }),
      providers: [provideRouter([{ path: '**', children: [] }]) as unknown as Provider],
      transport: new TransportFalso(),
    });
    montado.store.inspector.set({ type: 'movement', id: movimiento.id });
    montado.cambios();
    await montado.estable();
    montado.cambios();
    return document.body.querySelector('[data-testid="desglose-del-pago"]');
  }

  it('un pago con desglose lo lista con el concepto y el monto de cada parte', async () => {
    const seccion = await abrir(
      pago([
        { concepto: CARD_BUCKET.fees, monto: 50_000 },
        { concepto: CARD_BUCKET.singleInstallmentPurchases, monto: 100_000 },
      ]),
    );

    expect(seccion).not.toBeNull();
    expect(seccion!.querySelectorAll('div.flex')).toHaveLength(2);
    expect(seccion!.textContent).toContain('50');
    expect(seccion!.textContent).toContain('100');
  });

  it('un pago sin desglose no muestra la sección', async () => {
    expect(await abrir(pago())).toBeNull();
  });
});
