import type {
  Dimension as DimensionDelMotor,
  Granularidad,
  Measure as MedidaDelMotor,
  TipoVisual,
} from '@shared/graficas/modelo';
import { VISUALES } from '@shared/graficas/catalogo';
export type Scale = 'day' | 'week' | 'month' | 'year';
export type FixedWidgetType =
  'flow' | 'trend' | 'categories' | 'accounts' | 'scatter' | 'donut' | 'stacked' | 'heatmap' | 'gauge' | 'histogram';
export type GenericWidgetType =
  | Exclude<TipoVisual, 'line'>
  | 'line'
  | 'area'
  | 'bar'
  | 'barH'
  | 'grouped'
  | 'stackedBars'
  | 'stacked100'
  | 'pie'
  | 'treemap'
  | 'funnel'
  | 'waterfall'
  | 'card'
  | 'matrix'
  | 'table'
  | 'indicator'
  | 'colorScale'
  | 'statusBars';
export type WidgetType = FixedWidgetType | GenericWidgetType;
export type Dimension = DimensionDelMotor;
export type Seleccion =
  | { readonly tipo: 'dimension'; readonly dimension: Dimension; readonly label: string }
  | { readonly tipo: 'importe'; readonly min: number; readonly max: number; readonly label: string };
export type Measure = MedidaDelMotor;
export type KpiFormula =
  | Measure
  | 'savingsRate'
  | 'expenseShare'
  | 'dailyExpense'
  | 'dailyIncome'
  | 'liquidityMonths'
  | 'expenseConcentration'
  | 'debtToIncome'
  | 'daysToDeplete'
  | 'avgPaymentDelay'
  | 'fixedExpenseShare'
  | 'installmentExpenseShare'
  | 'creditUtilization'
  | 'mostUsedCard';
export type Widget = {
  id: string;
  title: string;
  kicker: string;
  type: WidgetType;
  wide: boolean;
  capability?: string;
  dimension?: Dimension;
  dimension2?: Dimension;
  measure?: Measure;
  goalMin?: number;
  goalTarget?: number;
  goalMax?: number;
  variant?: string;
  granularity?: Granularidad;
  limit?: number;
};
export const GENERIC_TYPES: readonly GenericWidgetType[] = [
  ...VISUALES.map((v) => v.tipo),
  'card',
  'table',
  'indicator',
  'colorScale',
  'statusBars',
];
export const TWO_DIMENSION_TYPES: readonly WidgetType[] = VISUALES.filter((v) => v.dimensiones === 2).map(
  (v) => v.tipo,
);
export type TimelinePoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  incomeP: number;
  expenseP: number;
};
export type CategorySlice = { name: string; value: number; percent: number; color: string };
