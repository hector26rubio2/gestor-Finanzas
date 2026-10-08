import type { Movement } from '@core/state';
import { esGasto, montoDeGasto } from '@core/state/economia';

export interface PuntoDeFlujo {
  readonly key: string;
  readonly label: string;
  readonly income: number;
  readonly expense: number;
}

export interface Tramo {
  readonly etiqueta: string;
  readonly ingresos: number;
  readonly gastos: number;
  readonly saldo: number;
}

const DIAS_POR_SEMANA = 7;
const ULTIMA_SEMANA = 3;
const MINIMO_DE_GASTOS_PARA_COMPARAR = 5;
const VECES_LA_MEDIANA = 5;

export function tramosSemanales(
  puntos: readonly PuntoDeFlujo[],
  etiqueta: (inicio: number, fin: number) => string,
): Tramo[] {
  const tramos = new Map<number, { inicio: number; fin: number; ingresos: number; gastos: number }>();
  for (const punto of puntos) {
    const dia = Number(punto.key.slice(8, 10));
    const indice = Math.min(ULTIMA_SEMANA, Math.floor((dia - 1) / DIAS_POR_SEMANA));
    const tramo = tramos.get(indice) ?? { inicio: indice * DIAS_POR_SEMANA + 1, fin: dia, ingresos: 0, gastos: 0 };
    tramo.fin = Math.max(tramo.fin, dia);
    tramo.ingresos += punto.income;
    tramo.gastos += punto.expense;
    tramos.set(indice, tramo);
  }
  return acumular(
    [...tramos.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, tramo]) => ({
        etiqueta: etiqueta(tramo.inicio, tramo.fin),
        ingresos: tramo.ingresos,
        gastos: tramo.gastos,
      })),
  );
}

export function tramosDirectos(puntos: readonly PuntoDeFlujo[]): Tramo[] {
  return acumular(puntos.map((punto) => ({ etiqueta: punto.label, ingresos: punto.income, gastos: punto.expense })));
}

function acumular(tramos: readonly Omit<Tramo, 'saldo'>[]): Tramo[] {
  let saldo = 0;
  return tramos.map((tramo) => {
    saldo += tramo.ingresos - tramo.gastos;
    return { ...tramo, saldo };
  });
}

export function gastoInusual(
  movimientos: readonly Movement[],
): { movimiento: Movement; veces: number; monto: number } | null {
  const gastos = movimientos
    .filter((movimiento) => esGasto(movimiento) && !movimiento.anulado && !movimiento.recurring)
    .map((movimiento) => ({ movimiento, monto: montoDeGasto(movimiento) }))
    .filter((gasto) => gasto.monto > 0);
  if (gastos.length < MINIMO_DE_GASTOS_PARA_COMPARAR) return null;
  const montos = gastos.map((gasto) => gasto.monto).sort((a, b) => a - b);
  const mediana = montos[Math.floor(montos.length / 2)];
  const mayor = gastos.reduce((actual, gasto) => (gasto.monto > actual.monto ? gasto : actual));
  if (mediana <= 0 || mayor.monto < VECES_LA_MEDIANA * mediana) return null;
  return { movimiento: mayor.movimiento, veces: Math.round(mayor.monto / mediana), monto: mayor.monto };
}

export function variacionPorcentual(actual: number, base: number | null): number | null {
  if (base === null || base === 0) return null;
  return ((actual - base) / Math.abs(base)) * 100;
}
