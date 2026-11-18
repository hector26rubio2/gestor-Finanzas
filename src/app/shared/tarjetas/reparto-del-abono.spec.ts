import { describe, expect, it } from 'vitest';
import { CARD_BUCKET, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, type CardBucket } from '@core/api';
import { type CompraPendiente, aplicarAbono, saldosPorConcepto } from './extracto';

const compra = (concepto: CardBucket, pendiente: number, id = `${concepto}`): CompraPendiente => ({
  id,
  fecha: '2026-09-01',
  descripcion: id,
  concepto,
  cuotaActual: 1,
  cuotas: 1,
  cuotaDelMes: pendiente,
  pendiente,
});

const saldos = (...pares: [CardBucket, number][]) =>
  saldosPorConcepto(
    pares.map(([concepto, monto]) => compra(concepto, monto)),
    PRIORIDAD_EN_PESOS,
  );

const deuda = () =>
  saldos(
    [CARD_BUCKET.deferredInstallmentPurchases, 400_000],
    [CARD_BUCKET.singleInstallmentPurchases, 200_000],
    [CARD_BUCKET.fees, 30_000],
    [CARD_BUCKET.pastDue, 50_000],
  );

describe('reparto de un abono a la tarjeta', () => {
  it('el orden en pesos es el de la API: mora, comisiones, y luego las compras', () => {
    expect(PRIORIDAD_EN_PESOS).toEqual(Array.from({ length: 19 }, (_, indice) => indice + 1));
    expect(deuda().map((s) => s.concepto)).toEqual([
      CARD_BUCKET.pastDue,
      CARD_BUCKET.fees,
      CARD_BUCKET.singleInstallmentPurchases,
      CARD_BUCKET.deferredInstallmentPurchases,
    ]);
  });

  it('un abono corto paga primero la mora y no toca lo demás', () => {
    const reparto = aplicarAbono(deuda(), 30_000);

    expect(reparto.map((fila) => fila.aplicado)).toEqual([30_000, 0, 0, 0]);
    expect(reparto[0].despues).toBe(20_000);
  });

  it('cubre la mora, luego las comisiones y lo que sobre va a las compras', () => {
    const reparto = aplicarAbono(deuda(), 100_000);

    expect(reparto.map((fila) => fila.aplicado)).toEqual([50_000, 30_000, 20_000, 0]);
    expect(reparto.map((fila) => fila.despues)).toEqual([0, 0, 180_000, 400_000]);
  });

  it('lo aplicado más lo que queda siempre da lo que había antes', () => {
    for (const monto of [1, 49_999.99, 80_000, 280_000, 680_000]) {
      for (const fila of aplicarAbono(deuda(), monto)) expect(fila.aplicado + fila.despues).toBeCloseTo(fila.antes, 2);
    }
  });

  it('un abono mayor a la deuda paga todo y el sobrante queda fuera del reparto', () => {
    const reparto = aplicarAbono(deuda(), 1_000_000);
    const aplicado = reparto.reduce((total, fila) => total + fila.aplicado, 0);

    expect(reparto.map((fila) => fila.despues)).toEqual([0, 0, 0, 0]);
    expect(aplicado).toBe(680_000);
    expect(1_000_000 - aplicado).toBe(320_000);
  });

  it('un abono en cero o negativo no aplica nada', () => {
    expect(aplicarAbono(deuda(), 0).every((fila) => fila.aplicado === 0)).toBe(true);
    expect(aplicarAbono(deuda(), -50).every((fila) => fila.aplicado === 0)).toBe(true);
  });

  it('con la prioridad en dólares las comisiones y la mora también van primero', () => {
    const enDolares = saldosPorConcepto(
      [
        compra(CARD_BUCKET.cashAdvances, 60),
        compra(CARD_BUCKET.deferredInstallmentPurchases, 100),
        compra(CARD_BUCKET.fees, 5),
        compra(CARD_BUCKET.pastDue, 10),
      ],
      PRIORIDAD_EN_DOLARES,
    );

    expect(enDolares.map((s) => s.concepto)).toEqual([
      CARD_BUCKET.pastDue,
      CARD_BUCKET.fees,
      CARD_BUCKET.deferredInstallmentPurchases,
      CARD_BUCKET.cashAdvances,
    ]);
  });

  it('los centavos se reparten sin perder ni inventar valor', () => {
    const reparto = aplicarAbono(saldos([CARD_BUCKET.pastDue, 10.1], [CARD_BUCKET.fees, 20.2]), 15.15);

    expect(reparto.map((fila) => fila.aplicado)).toEqual([10.1, 5.05]);
  });
});
