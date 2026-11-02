import type { ApiDashboard } from '@core/api/reporting.api';
import { esEconomico, totalDeGastos, totalDeIngresos } from '@core/state/economia';
import type { Account, Movement } from '@core/state/view-model';
import { parseMoney } from '@core/utils/money';
import { SIN_DATO } from '@shared/utils';

export interface Rango {
  readonly start: string;
  readonly end: string;
}

export interface FiltrosDeResumen {
  readonly cuentaId?: string;
  readonly tipoDeCuenta?: string;
  readonly categoria?: string;
  readonly predicado?: (movimiento: Movement) => boolean;
}

export interface ResumenDelPeriodo {
  readonly ingreso: number;
  readonly gasto: number;
  readonly neto: number;
  readonly tasaDeAhorro: number | null;
  readonly economicos: readonly Movement[] | null;
}

export interface FuentesDeResumen {
  readonly movimientos: readonly Movement[];
  readonly tablero: ApiDashboard | null;
  readonly cuentaDe: (id: string) => Account | undefined;
}

export function tasaDeAhorro(ingreso: number, neto: number): number | null {
  return ingreso > 0 ? (neto / ingreso) * 100 : null;
}

export function formatoDeTasaDeAhorro(tasa: number | null): string {
  return tasa === null ? SIN_DATO : `${Math.round(tasa)} %`;
}

function armar(ingreso: number, gasto: number, economicos: readonly Movement[] | null): ResumenDelPeriodo {
  const neto = ingreso - gasto;
  return { ingreso, gasto, neto, tasaDeAhorro: tasaDeAhorro(ingreso, neto), economicos };
}

export function resumenDeTotales(ingreso: number, gasto: number): ResumenDelPeriodo {
  return armar(ingreso, gasto, null);
}

const sinFiltros = (filtros: FiltrosDeResumen) =>
  !filtros.cuentaId && !filtros.tipoDeCuenta && !filtros.categoria && !filtros.predicado;

export function resumenDeMovimientos(
  movimientos: readonly Movement[],
  rango: Rango,
  filtros: FiltrosDeResumen,
  cuentaDe: (id: string) => Account | undefined,
): ResumenDelPeriodo {
  const economicos = movimientos.filter(
    (m) =>
      m.date >= rango.start &&
      m.date <= rango.end &&
      esEconomico(m) &&
      (!filtros.cuentaId || m.accountId === filtros.cuentaId) &&
      (!filtros.tipoDeCuenta || cuentaDe(m.accountId)?.type === filtros.tipoDeCuenta) &&
      (!filtros.categoria || m.category === filtros.categoria) &&
      (!filtros.predicado || filtros.predicado(m)),
  );
  return armar(totalDeIngresos(economicos), totalDeGastos(economicos), economicos);
}

export function resumenDelServidor(
  tablero: ApiDashboard | null,
  rango: Rango,
  filtros: FiltrosDeResumen,
): ResumenDelPeriodo | null {
  if (!tablero || !sinFiltros(filtros)) return null;
  const { start, end } = tablero.period.period;
  if (start !== rango.start || end !== rango.end) return null;
  return armar(parseMoney(tablero.period.income), parseMoney(tablero.period.expense), null);
}

export function resumenDelPeriodo(
  fuentes: FuentesDeResumen,
  rango: Rango,
  filtros: FiltrosDeResumen,
): ResumenDelPeriodo {
  return (
    resumenDelServidor(fuentes.tablero, rango, filtros) ??
    resumenDeMovimientos(fuentes.movimientos, rango, filtros, fuentes.cuentaDe)
  );
}
