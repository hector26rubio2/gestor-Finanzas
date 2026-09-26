import { KpiFormula } from '../dashboard.model';

export type KpiStatus = 'good' | 'warn' | 'bad';

export interface KpiRanges {
  readonly warnAt: number;
  readonly badAt: number;
  readonly higherIsWorse: boolean;
}

export const RANGOS_POR_DEFECTO: Partial<Record<KpiFormula, KpiRanges>> = {
  creditUtilization: { warnAt: 30, badAt: 70, higherIsWorse: true },
  debtToIncome: { warnAt: 30, badAt: 50, higherIsWorse: true },
  expenseShare: { warnAt: 80, badAt: 95, higherIsWorse: true },
  savingsRate: { warnAt: 20, badAt: 10, higherIsWorse: false },
  expenseConcentration: { warnAt: 40, badAt: 60, higherIsWorse: true },
  fixedExpenseShare: { warnAt: 50, badAt: 70, higherIsWorse: true },
  installmentExpenseShare: { warnAt: 20, badAt: 40, higherIsWorse: true },
  liquidityMonths: { warnAt: 6, badAt: 3, higherIsWorse: false },
  daysToDeplete: { warnAt: 90, badAt: 30, higherIsWorse: false },
  avgPaymentDelay: { warnAt: 15, badAt: 30, higherIsWorse: true },
};

export function esRangoValido(valor: unknown): valor is KpiRanges {
  const rango = valor as KpiRanges;
  return (
    !!rango && Number.isFinite(rango.warnAt) && Number.isFinite(rango.badAt) && typeof rango.higherIsWorse === 'boolean'
  );
}

export function estadoDe(valor: number, rangos: KpiRanges | null | undefined): KpiStatus | null {
  if (!rangos || !Number.isFinite(valor)) return null;
  if (rangos.higherIsWorse) {
    if (valor >= rangos.badAt) return 'bad';
    if (valor >= rangos.warnAt) return 'warn';
    return 'good';
  }
  if (valor <= rangos.badAt) return 'bad';
  if (valor <= rangos.warnAt) return 'warn';
  return 'good';
}
