import type {
  Dimension as DimensionDelMotor,
  Granularidad,
  Measure as MedidaDelMotor,
  TipoVisual,
} from '@shared/graficas/modelo';
import { VISUALES } from '@shared/graficas/catalogo';
export type Scale = 'day' | 'week' | 'month' | 'year';
/**
 * Los nueve primeros son fijos: cada uno trae su propia lógica de datos (ingresos vs
 * gastos, categorías con click-to-filter, dispersión fecha/importe...) y no aceptan
 * dimension/measure. Los que siguen son genéricos: cualquier combinación de dimensión y
 * métrica pasa por `aggregate`/`aggregate2D` y `widgetOption`, que es lo que hace posible
 * "crear un widget nuevo eligiendo qué medir" en vez de una lista cerrada de graficas.
 */
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
/** Eje / agrupación disponible para un widget genérico. */
export type Dimension = DimensionDelMotor;
export type Seleccion =
  | { readonly tipo: 'dimension'; readonly dimension: Dimension; readonly label: string }
  | { readonly tipo: 'importe'; readonly min: number; readonly max: number; readonly label: string };
/** Qué se mide dentro de cada grupo de la dimensión. */
export type Measure = MedidaDelMotor;
/**
 * Las cinco medidas simples, mas formulas que cruzan ingreso y gasto -solo para la franja
 * de KPI de arriba, no para los widgets del grid, que ya tienen su propio motor de
 * dimension/medida.
 */
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
  /** Solo para `type: 'indicator'`: escala y meta del KPI, cada tramo con su propio color. */
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
