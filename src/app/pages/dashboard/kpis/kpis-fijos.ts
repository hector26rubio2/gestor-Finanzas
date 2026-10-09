import { P } from '@core/session';
import { IconName } from '@ui/icon';
import { KpiFormula } from '@shared/tablero/dashboard.model';
import { KpiRanges, KpiStatus } from '@shared/tablero/kpi-ranges';

export interface FixedKpiItem {
  key: string;
  label: string;
  icon: IconName;
  tone: 'accent' | 'success' | 'danger';
  value: string;
  hint: string;
  series: readonly number[];
  delta: number | null;
  subirEsBueno: boolean;
  status: KpiStatus | null;
  caption: string;
  ranges: KpiRanges | null;
}

type Tendencia = Pick<FixedKpiItem, 'series' | 'delta' | 'status' | 'ranges' | 'caption'>;

export interface KpisFijosContexto {
  allows(permiso: string): boolean;
  t(key: string): string;
  money(value: number): string;
  number(value: number): string;
  periodLabel: string;
  net: number;
  income: number;
  expense: number;
  count: number;
  tendencia(key: string, formula: KpiFormula, valor: number): Tendencia;
}

export function construirKpisFijos(ctx: KpisFijosContexto): FixedKpiItem[] {
  const definiciones: (Omit<FixedKpiItem, keyof Tendencia> & {
    permiso: string;
    formula: KpiFormula;
    bruto: number;
  })[] = [
    {
      permiso: P.dashboard.kpi.balance,
      key: 'balance',
      formula: 'amount',
      bruto: ctx.net,
      label: ctx.t('dashboard.kpi.balance.label'),
      icon: 'wallet',
      tone: 'accent',
      value: ctx.money(ctx.net),
      hint: ctx.periodLabel,
      subirEsBueno: true,
    },
    {
      permiso: P.dashboard.kpi.ingresos,
      key: 'ingresos',
      formula: 'income',
      bruto: ctx.income,
      label: ctx.t('dashboard.kpi.income.label'),
      icon: 'cash',
      tone: 'success',
      value: ctx.money(ctx.income),
      hint: ctx.t('dashboard.kpi.defaultHint'),
      subirEsBueno: true,
    },
    {
      permiso: P.dashboard.kpi.gastos,
      key: 'gastos',
      formula: 'expense',
      bruto: ctx.expense,
      label: ctx.t('dashboard.kpi.expense.label'),
      icon: 'cart',
      tone: 'danger',
      value: ctx.money(ctx.expense),
      hint: ctx.t('dashboard.kpi.defaultHint'),
      subirEsBueno: false,
    },
    {
      permiso: P.dashboard.kpi.recuento,
      key: 'recuento',
      formula: 'count',
      bruto: ctx.count,
      label: ctx.t('dashboard.kpi.count.label'),
      icon: 'movements',
      tone: 'accent',
      value: ctx.number(ctx.count),
      hint: ctx.t('dashboard.kpi.count.hint'),
      subirEsBueno: true,
    },
  ];
  return definiciones
    .filter((definicion) => ctx.allows(definicion.permiso))
    .map(({ permiso, formula, bruto, ...kpi }) => {
      void permiso;
      return { ...kpi, ...ctx.tendencia(kpi.key, formula, bruto) };
    });
}
