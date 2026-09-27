import { IconName } from '@ui/icon';
import { UiOption } from '@ui/select';
import { KpiFormula } from '@shared/tablero/dashboard.model';
import { KpiDefinition } from '@shared/tablero/dashboard-layout.service';
import type { Movement } from '@core/state';
import { sumBy } from '@core/utils';
import type { PuntoDeFlujo } from '@shared/historia';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const FORMULAS_DERIVADAS: readonly KpiFormula[] = [
  'savingsRate',
  'expenseShare',
  'dailyExpense',
  'dailyIncome',
  'liquidityMonths',
  'expenseConcentration',
  'debtToIncome',
  'daysToDeplete',
  'avgPaymentDelay',
  'fixedExpenseShare',
  'installmentExpenseShare',
  'creditUtilization',
  'mostUsedCard',
];

const FORMULAS_EN_PORCENTAJE = ([] = [
  'savingsRate',
  'expenseShare',
  'debtToIncome',
  'expenseConcentration',
  'fixedExpenseShare',
  'installmentExpenseShare',
  'creditUtilization',
] as const);

type FormulaEnPorcentaje = (typeof FORMULAS_EN_PORCENTAJE)[number];

export function enPorcentaje(formula: KpiFormula): formula is FormulaEnPorcentaje {
  return (FORMULAS_EN_PORCENTAJE as readonly KpiFormula[]).includes(formula);
}

const FORMULAS_DE_GASTO: readonly KpiFormula[] = [
  'expense',
  'dailyExpense',
  'expenseShare',
  'expenseConcentration',
  'debtToIncome',
  'avgPaymentDelay',
  'fixedExpenseShare',
  'installmentExpenseShare',
  'creditUtilization',
];

const FORMULAS_DE_INGRESO: readonly KpiFormula[] = [
  'income',
  'dailyIncome',
  'savingsRate',
  'liquidityMonths',
  'daysToDeplete',
];

const ICONO_POR_FORMULA: Partial<Record<KpiFormula, IconName>> = {
  amount: 'wallet',
  income: 'cash',
  dailyIncome: 'cash',
  expense: 'cart',
  dailyExpense: 'cart',
  count: 'movements',
  average: 'movements',
  savingsRate: 'savings',
  expenseShare: 'percent',
  expenseConcentration: 'percent',
  fixedExpenseShare: 'percent',
  installmentExpenseShare: 'percent',
  debtToIncome: 'percent',
  creditUtilization: 'percent',
  liquidityMonths: 'clock',
  daysToDeplete: 'clock',
  avgPaymentDelay: 'clock',
  mostUsedCard: 'accounts',
};

export function kpisSembrados(t: Translate): readonly KpiDefinition[] {
  return (['average', ...FORMULAS_DERIVADAS] as const).map((formula) => ({
    id: `k-${formula}`,
    label: t(formula === 'average' ? 'dashboard.measure.average' : `dashboard.kpiFormula.${formula}`),
    formula,
  }));
}

export function opcionesDeFormulasDerivadas(t: Translate): UiOption[] {
  return FORMULAS_DERIVADAS.map((formula) => ({ value: formula, label: t(`dashboard.kpiFormula.${formula}`) }));
}

export function iconoDeKpi(formula: KpiFormula): IconName {
  return ICONO_POR_FORMULA[formula] ?? 'movements';
}

export function tonoDeKpi(formula: KpiFormula): 'accent' | 'success' | 'danger' {
  if (FORMULAS_DE_INGRESO.includes(formula)) return 'success';
  if (FORMULAS_DE_GASTO.includes(formula)) return 'danger';
  return 'accent';
}

export function subirEsBueno(formula: KpiFormula): boolean {
  return !FORMULAS_DE_GASTO.includes(formula);
}

export function diasDelRango(rango: { start: string; end: string }): number {
  const inicio = new Date(`${rango.start}T00:00:00Z`).getTime();
  const fin = new Date(`${rango.end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((fin - inicio) / 86_400_000) + 1);
}

type Medir = (movs: readonly Movement[], medida: 'amount' | 'count' | 'average' | 'expense') => number;

export function gastoFiltrado(movs: readonly Movement[], cumple: (m: Movement) => boolean): number {
  return sumBy(
    movs.filter((m) => m.amount < 0 && cumple(m)),
    (m) => -m.amount,
  );
}

const economicosDe = (movs: readonly Movement[]) => movs.filter((m) => !m.movementSubtype && m.kind !== 'payment');

export function valorDeKpiEnPunto(formula: KpiFormula, p: PuntoDeFlujo, medir: Medir): number | null {
  if (formula === 'amount') return p.net;
  if (formula === 'income') return p.income;
  if (formula === 'expense') return p.expense;
  if (formula === 'savingsRate') return p.income > 0 ? ((p.income - p.expense) / p.income) * 100 : null;
  if (formula === 'expenseShare') return p.income > 0 ? (p.expense / p.income) * 100 : null;
  if (formula === 'dailyExpense') return p.expense / diasDelRango(p.rango);
  if (formula === 'dailyIncome') return p.income / diasDelRango(p.rango);
  if (!p.movs) return null;
  if (formula === 'count' || formula === 'average') return medir(p.movs, formula);
  const economicos = economicosDe(p.movs);
  const gasto = medir(economicos, 'expense');
  if (gasto <= 0) return 0;
  if (formula === 'fixedExpenseShare') return (gastoFiltrado(economicos, (m) => !!m.recurring) / gasto) * 100;
  if (formula === 'installmentExpenseShare')
    return (gastoFiltrado(economicos, (m) => (m.installmentTotal ?? 1) > 1) / gasto) * 100;
  if (formula === 'expenseConcentration') {
    const porCategoria = new Map<string, number>();
    for (const m of economicos)
      if (m.amount < 0) porCategoria.set(m.category, (porCategoria.get(m.category) ?? 0) - m.amount);
    return (Math.max(0, ...porCategoria.values()) / gasto) * 100;
  }
  return null;
}

export function valorDeKpiSobre(formula: KpiFormula, movs: readonly Movement[], dias: number, medir: Medir): number {
  const economicos = economicosDe(movs);
  const ingreso = sumBy(
    economicos.filter((m) => m.kind === 'income'),
    (m) => Math.max(0, m.amount),
  );
  const gasto = sumBy(
    economicos.filter((m) => m.kind === 'expense'),
    (m) => -Math.min(0, m.amount),
  );
  if (formula === 'income') return ingreso;
  if (formula === 'expense') return gasto;
  if (formula === 'savingsRate') return ingreso > 0 ? ((ingreso - gasto) / ingreso) * 100 : 0;
  if (formula === 'expenseShare') return ingreso > 0 ? (gasto / ingreso) * 100 : 0;
  if (formula === 'dailyExpense') return gasto / dias;
  if (formula === 'dailyIncome') return ingreso / dias;
  if (formula === 'amount' || formula === 'count' || formula === 'average') return medir(movs, formula);
  return 0;
}
