import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ApiMovement } from '@core/api/api-client';
import { CARD_BUCKET } from '@core/api';
import { P } from '@core/session/permissions';
import type { Account } from '@core/state';
import { todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { InspectorCard } from './inspector-card';

const tarjeta = (sobre: Partial<Account> = {}): Account => ({
  id: 't1',
  name: 'Visa',
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  limit: 5_000_000,
  annualRate: 24,
  monthlyFee: 10_000,
  ...sobre,
});

@Component({ selector: 'prueba-inspector-card', template: '' })
class Anfitrion {
  readonly cuenta = signal<Account | undefined>(undefined);
  readonly inspector = new InspectorCard(() => this.cuenta());
}

const compra = (id: string, monto: number, extra: Partial<ApiMovement> = {}): ApiMovement => {
  const importe = { amount: String(monto), currency: 'COP' };
  return {
    id,
    date: todayIso(),
    kind: 20,
    effect: 2,
    flow: 2,
    amount: { original: importe, base: importe, rate: '1', rateAsOf: todayIso() },
    links: { card: 't1' },
    linkNames: {},
    origin: 0,
    description: id,
    createdAt: '2026-10-05T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...extra,
  };
};

async function montar(movimientos: ApiMovement[], cuenta: Account = tarjeta()) {
  const transport = new TransportFalso().responder(/^POST \/api\/v1\/movements\/search/, {
    body: { items: movimientos, hasNext: false },
  });
  const montado = pruebaRender(Anfitrion, {
    transport,
    session: sesionDe().conCapacidad(P.cuentas.ver, P.movimientos.ver),
    data: datosDe({ accounts: [cuenta] }),
  });
  montado.component.cuenta.set(cuenta);
  for (let i = 0; i < 3; i++) {
    montado.cambios();
    await montado.estable();
  }
  return montado.component.inspector;
}

describe('extracto estimado de una tarjeta', () => {
  it('el interés del mes es el saldo pendiente por la tasa anual de la tarjeta entre doce', async () => {
    const inspector = await montar([
      compra('compra', 600_000, { installments: 6, cardBucket: CARD_BUCKET.deferredInstallmentPurchases }),
    ]);

    expect(inspector.cardEstimatedInterest()).toBe(12_000);
  });

  it('una compra con tasa propia usa esa tasa y no la de la tarjeta', async () => {
    const inspector = await montar([
      compra('compra', 600_000, {
        installments: 6,
        cardBucket: CARD_BUCKET.deferredInstallmentPurchases,
        purchaseApr: 12,
      }),
    ]);

    expect(inspector.cardEstimatedInterest()).toBe(6_000);
  });

  it('las compras a una cuota y a tasa cero no generan interés', async () => {
    const inspector = await montar([
      compra('contado', 200_000, { cardBucket: CARD_BUCKET.singleInstallmentPurchases }),
      compra('cero', 300_000, { installments: 3, cardBucket: CARD_BUCKET.zeroRatePurchases }),
    ]);

    expect(inspector.cardEstimatedInterest()).toBe(0);
  });

  it('sin tasa en la tarjeta ni en la compra no estima interés', async () => {
    const inspector = await montar(
      [compra('compra', 600_000, { installments: 6, cardBucket: CARD_BUCKET.deferredInstallmentPurchases })],
      tarjeta({ annualRate: undefined }),
    );

    expect(inspector.cardEstimatedInterest()).toBeNull();
  });

  it('el extracto suma las cuotas del mes, el interés y la cuota de manejo', async () => {
    const inspector = await montar([
      compra('compra', 600_000, { installments: 6, cardBucket: CARD_BUCKET.deferredInstallmentPurchases }),
    ]);

    expect(inspector.nextInstallments()).toBe(100_000);
    expect(inspector.cuotaDeManejo()).toBe(10_000);
    expect(inspector.cardStatementTotal()).toBe(100_000 + 12_000 + 10_000);
  });
});
