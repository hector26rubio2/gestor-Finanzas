import type { Movement } from '@core/state';
import { sumBy } from '@core/utils';
import { type CardBucket, conceptoDeCompra } from '@core/api';

export interface CompraPendiente {
  readonly id: string;
  readonly fecha: string;
  readonly descripcion: string;
  readonly concepto: CardBucket;
  readonly cuotaActual: number;
  readonly cuotas: number;
  readonly cuotaDelMes: number;
  readonly pendiente: number;
}

export interface SaldoPorConcepto {
  readonly concepto: CardBucket;
  readonly compras: readonly CompraPendiente[];
  readonly saldo: number;
}

export interface AplicacionDeAbono {
  readonly concepto: CardBucket;
  readonly antes: number;
  readonly aplicado: number;
  readonly despues: number;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function comprasPendientes(movimientos: readonly Movement[]): CompraPendiente[] {
  const cargos = movimientos
    .filter((m) => m.kind === 'expense' && m.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const pagos = sumBy(
    movimientos.filter((m) => m.kind !== 'expense' && m.amount > 0),
    (m) => m.amount,
  );
  const brutas = cargos.map((m) => {
    const cuotas = Math.max(1, m.installmentTotal ?? 1);
    const cuotaActual = Math.min(cuotas, Math.max(1, m.installmentCurrent ?? 1));
    const monto = Math.abs(m.amount);
    const concepto = conceptoDeCompra({
      kind: m.kind,
      cardBucket: m.cardBucket,
      installmentTotal: cuotas,
      originalCurrency: m.originalCurrency,
      movementSubtype: m.movementSubtype,
    }) as CardBucket;
    return {
      id: m.id,
      fecha: m.date,
      descripcion: m.description,
      concepto,
      cuotaActual,
      cuotas,
      cuotaDelMes: redondear(monto / cuotas),
      pendiente: redondear((monto * (cuotas - cuotaActual + 1)) / cuotas),
    };
  });
  let porDescontar = pagos - sumBy(brutas, (c) => Math.max(0, c.cuotaDelMes * (c.cuotaActual - 1)));
  return brutas
    .map((compra) => {
      const descuento = Math.min(compra.pendiente, Math.max(0, porDescontar));
      porDescontar -= descuento;
      return { ...compra, pendiente: redondear(compra.pendiente - descuento) };
    })
    .filter((compra) => compra.pendiente > 0.005);
}

export function saldosPorConcepto(
  compras: readonly CompraPendiente[],
  prioridad: readonly CardBucket[],
): SaldoPorConcepto[] {
  const orden = (concepto: CardBucket) => {
    const posicion = prioridad.indexOf(concepto);
    return posicion < 0 ? prioridad.length : posicion;
  };
  const conceptos = [...new Set(compras.map((c) => c.concepto))].sort((a, b) => orden(a) - orden(b));
  return conceptos.map((concepto) => {
    const delConcepto = compras.filter((c) => c.concepto === concepto);
    return { concepto, compras: delConcepto, saldo: redondear(sumBy(delConcepto, (c) => c.pendiente)) };
  });
}

export function aplicarAbono(saldos: readonly SaldoPorConcepto[], monto: number): AplicacionDeAbono[] {
  let restante = Math.max(0, monto);
  return saldos.map((saldo) => {
    const aplicado = redondear(Math.min(saldo.saldo, restante));
    restante = redondear(restante - aplicado);
    return { concepto: saldo.concepto, antes: saldo.saldo, aplicado, despues: redondear(saldo.saldo - aplicado) };
  });
}
