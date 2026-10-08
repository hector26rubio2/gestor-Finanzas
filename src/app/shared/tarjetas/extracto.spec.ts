import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { CARD_BUCKET, PRIORIDAD_EN_PESOS } from '@core/api';
import { aplicarAbono, comprasPendientes, saldosPorConcepto } from './extracto';

const mov = (parcial: Partial<Movement>): Movement => ({
  id: parcial.id ?? crypto.randomUUID(),
  date: '2026-09-01',
  description: 'x',
  accountId: 'visa',
  category: 'c',
  kind: 'expense',
  amount: -100,
  status: 'confirmed',
  ...parcial,
});

describe('extracto de tarjeta', () => {
  it('deja pendiente solo las cuotas que faltan y descuenta los pagos según la prioridad', () => {
    const compras = comprasPendientes([
      mov({ id: 'tv', date: '2026-06-10', amount: -1_200_000, installmentTotal: 12, installmentCurrent: 4 }),
      mov({ id: 'mercado', date: '2026-09-05', amount: -300_000 }),
      mov({ id: 'pago', date: '2026-09-10', kind: 'payment', amount: 400_000 }),
    ]);
    const tv = compras.find((c) => c.id === 'tv')!;
    expect(tv.concepto).toBe(CARD_BUCKET.deferredInstallmentPurchases);
    expect(tv.cuotaDelMes).toBe(100_000);
    expect(tv.pendiente).toBe(900_000);
    expect(compras.find((c) => c.id === 'mercado')?.pendiente).toBe(200_000);
  });

  it('una compra anulada y su reverso no quedan pendientes', () => {
    const compras = comprasPendientes([
      mov({ id: 'anulada', date: '2026-09-03', amount: -500_000, anulado: true }),
      mov({ id: 'reverso', date: '2026-09-04', amount: 500_000, anulado: true }),
      mov({ id: 'mercado', date: '2026-09-05', amount: -300_000 }),
    ]);
    expect(compras.map((c) => c.id)).toEqual(['mercado']);
  });

  it('un pago ya hecho respeta la prioridad propia de la tarjeta', () => {
    const movimientos = [
      mov({ id: 'contado', date: '2026-09-01', amount: -200_000 }),
      mov({ id: 'avance', date: '2026-09-02', amount: -300_000, movementSubtype: 'advance' }),
      mov({ id: 'pago', date: '2026-09-10', kind: 'payment', amount: 250_000 }),
    ];
    const primeroAvances = [
      CARD_BUCKET.cashAdvances,
      ...PRIORIDAD_EN_PESOS.filter((c) => c !== CARD_BUCKET.cashAdvances),
    ];
    const compras = comprasPendientes(movimientos, primeroAvances);
    expect(compras.find((c) => c.id === 'avance')?.pendiente).toBe(50_000);
    expect(compras.find((c) => c.id === 'contado')?.pendiente).toBe(200_000);
  });

  it('un avance en dólares va a avances internacionales', () => {
    const [avance] = comprasPendientes([mov({ amount: -100, movementSubtype: 'advance', originalCurrency: 'USD' })]);
    expect(avance.concepto).toBe(CARD_BUCKET.internationalCashAdvances);
  });

  it('aplica el abono según la prioridad de la tarjeta', () => {
    const compras = comprasPendientes([
      mov({ id: 'avance', amount: -500_000, movementSubtype: 'advance' }),
      mov({ id: 'diferida', amount: -600_000, installmentTotal: 6 }),
      mov({ id: 'contado', amount: -200_000 }),
      mov({ id: 'cero', amount: -300_000, installmentTotal: 3, cardBucket: CARD_BUCKET.zeroRatePurchases }),
    ]);
    const saldos = saldosPorConcepto(compras, PRIORIDAD_EN_PESOS);
    expect(saldos.map((s) => s.concepto)).toEqual([
      CARD_BUCKET.singleInstallmentPurchases,
      CARD_BUCKET.deferredInstallmentPurchases,
      CARD_BUCKET.cashAdvances,
      CARD_BUCKET.zeroRatePurchases,
    ]);
    const abono = aplicarAbono(saldos, 900_000);
    expect(abono.map((a) => a.aplicado)).toEqual([200_000, 600_000, 100_000, 0]);
    expect(abono[2].despues).toBe(400_000);
  });
});
