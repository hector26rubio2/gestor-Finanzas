import type { Movement } from '@core/state';
import { sumBy } from '@core/utils';
import { type CardBucket, PRIORIDAD_EN_PESOS, conceptoDeCompra } from '@core/api';

export interface CompraPendiente {
  readonly id: string;
  readonly fecha: string;
  readonly descripcion: string;
  readonly concepto: CardBucket;
  readonly cuotaActual: number;
  readonly cuotas: number;
  readonly cuotaDelMes: number;
  readonly pendiente: number;
  readonly tasaAnual?: number;
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

export function comprasPendientes(
  movimientos: readonly Movement[],
  prioridad: readonly CardBucket[] = PRIORIDAD_EN_PESOS,
): CompraPendiente[] {
  const cargos = movimientos
    .filter((m) => !m.anulado && m.kind === 'expense' && m.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const pagos = sumBy(
    movimientos.filter((m) => !m.anulado && m.kind !== 'expense' && m.amount > 0),
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
      ...(m.purchaseApr !== undefined && m.purchaseApr !== null ? { tasaAnual: m.purchaseApr } : {}),
    };
  });
  let porDescontar = pagos - sumBy(brutas, (c) => Math.max(0, c.cuotaDelMes * (c.cuotaActual - 1)));
  const posicion = (concepto: CardBucket) => {
    const indice = prioridad.indexOf(concepto);
    return indice < 0 ? prioridad.length : indice;
  };
  const descuentos = new Map<string, number>();
  for (const compra of [...brutas].sort((a, b) => posicion(a.concepto) - posicion(b.concepto))) {
    const descuento = Math.min(compra.pendiente, Math.max(0, porDescontar));
    porDescontar -= descuento;
    descuentos.set(compra.id, descuento);
  }
  return brutas
    .map((compra) => ({ ...compra, pendiente: redondear(compra.pendiente - (descuentos.get(compra.id) ?? 0)) }))
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

export function ordenDeAbono(prioridad: readonly CardBucket[], aplicarPrioridad: boolean): readonly CardBucket[] {
  return aplicarPrioridad ? prioridad : [];
}

function aplicadoPorAntiguedad(saldos: readonly SaldoPorConcepto[], monto: number): Map<CardBucket, number> {
  const compras = saldos
    .flatMap((saldo) => saldo.compras)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const aplicado = new Map<CardBucket, number>();
  let restante = Math.max(0, monto);
  for (const compra of compras) {
    const parte = redondear(Math.min(compra.pendiente, restante));
    restante = redondear(restante - parte);
    aplicado.set(compra.concepto, redondear((aplicado.get(compra.concepto) ?? 0) + parte));
  }
  return aplicado;
}

export function aplicarAbono(
  saldos: readonly SaldoPorConcepto[],
  monto: number,
  porAntiguedad = false,
): AplicacionDeAbono[] {
  const deLaMasVieja = porAntiguedad ? aplicadoPorAntiguedad(saldos, monto) : null;
  let restante = Math.max(0, monto);
  return saldos.map((saldo) => {
    const aplicado = deLaMasVieja
      ? (deLaMasVieja.get(saldo.concepto) ?? 0)
      : redondear(Math.min(saldo.saldo, restante));
    restante = redondear(restante - aplicado);
    return { concepto: saldo.concepto, antes: saldo.saldo, aplicado, despues: redondear(saldo.saldo - aplicado) };
  });
}
