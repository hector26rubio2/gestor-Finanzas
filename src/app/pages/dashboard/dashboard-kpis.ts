import { Signal, computed, signal } from '@angular/core';
import { accountBalance, Movement } from '../../core/state/demo-data';
import { P } from '../../core/session/permissions';
import { IconName } from '../../ui/icon/icon';
import { UiOption } from '../../ui/select/select';
import { KpiFormula } from './dashboard.model';
import { DashboardVisuals } from './dashboard-visuals';

export abstract class DashboardKpis extends DashboardVisuals {
  abstract readonly range: Signal<{ start: string; end: string }>;

  variacion(serie: readonly number[]): number | null {
    if (serie.length < 2) return null;
    const ultimo = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    if (!anterior) return null;
    return ((ultimo - anterior) / Math.abs(anterior)) * 100;
  }

  /**
   * Indicadores creados a mano, añadidos a la franja de arriba junto a Balance/Ingresos/
   * Gastos/Movimientos. Antes esa franja era fija -cuatro tarjetas con permiso propio cada
   * una- y crear una nueva significaba tocar código; ahora es una lista mas, igual que los
   * widgets del grid de abajo.
   *
   * Ademas de las cinco medidas simples, hay formulas que cruzan ingreso y gasto -tasa de
   * ahorro, gasto diario- porque un numero suelto (solo "gasto") dice menos que "cuanto se
   * gasta por dia" o "que porcentaje del ingreso se va" para gestionar finanzas personales.
   */
  /*
   * Sembrado con las catorce fórmulas que no son ya alguno de los cuatro KPI fijos -mismo
   * criterio que la "GALERÍA" de widgets: que el usuario de prueba vea de entrada todo lo
   * que existe, sin tener que abrir "Crear indicador" catorce veces.
   */
  readonly customKpis = signal<{ id: string; label: string; formula: KpiFormula }[]>([
    { id: 'k-average', label: this.i18n.t('dashboard.measure.average'), formula: 'average' },
    { id: 'k-savingsRate', label: this.i18n.t('dashboard.kpiFormula.savingsRate'), formula: 'savingsRate' },
    { id: 'k-expenseShare', label: this.i18n.t('dashboard.kpiFormula.expenseShare'), formula: 'expenseShare' },
    { id: 'k-dailyExpense', label: this.i18n.t('dashboard.kpiFormula.dailyExpense'), formula: 'dailyExpense' },
    { id: 'k-dailyIncome', label: this.i18n.t('dashboard.kpiFormula.dailyIncome'), formula: 'dailyIncome' },
    { id: 'k-liquidityMonths', label: this.i18n.t('dashboard.kpiFormula.liquidityMonths'), formula: 'liquidityMonths' },
    {
      id: 'k-expenseConcentration',
      label: this.i18n.t('dashboard.kpiFormula.expenseConcentration'),
      formula: 'expenseConcentration',
    },
    { id: 'k-debtToIncome', label: this.i18n.t('dashboard.kpiFormula.debtToIncome'), formula: 'debtToIncome' },
    { id: 'k-daysToDeplete', label: this.i18n.t('dashboard.kpiFormula.daysToDeplete'), formula: 'daysToDeplete' },
    {
      id: 'k-avgPaymentDelay',
      label: this.i18n.t('dashboard.kpiFormula.avgPaymentDelay'),
      formula: 'avgPaymentDelay',
    },
    {
      id: 'k-fixedExpenseShare',
      label: this.i18n.t('dashboard.kpiFormula.fixedExpenseShare'),
      formula: 'fixedExpenseShare',
    },
    {
      id: 'k-installmentExpenseShare',
      label: this.i18n.t('dashboard.kpiFormula.installmentExpenseShare'),
      formula: 'installmentExpenseShare',
    },
    {
      id: 'k-creditUtilization',
      label: this.i18n.t('dashboard.kpiFormula.creditUtilization'),
      formula: 'creditUtilization',
    },
    { id: 'k-mostUsedCard', label: this.i18n.t('dashboard.kpiFormula.mostUsedCard'), formula: 'mostUsedCard' },
  ]);
  readonly kpiCreatorOpen = signal(false);
  newKpiLabel = '';
  newKpiFormula: KpiFormula = 'income';
  readonly kpiFormulaOptions = computed<readonly UiOption[]>(() => [
    ...this.measureOptions(),
    { value: 'savingsRate', label: this.i18n.t('dashboard.kpiFormula.savingsRate') },
    { value: 'expenseShare', label: this.i18n.t('dashboard.kpiFormula.expenseShare') },
    { value: 'dailyExpense', label: this.i18n.t('dashboard.kpiFormula.dailyExpense') },
    { value: 'dailyIncome', label: this.i18n.t('dashboard.kpiFormula.dailyIncome') },
    { value: 'liquidityMonths', label: this.i18n.t('dashboard.kpiFormula.liquidityMonths') },
    { value: 'expenseConcentration', label: this.i18n.t('dashboard.kpiFormula.expenseConcentration') },
    { value: 'debtToIncome', label: this.i18n.t('dashboard.kpiFormula.debtToIncome') },
    { value: 'daysToDeplete', label: this.i18n.t('dashboard.kpiFormula.daysToDeplete') },
    { value: 'avgPaymentDelay', label: this.i18n.t('dashboard.kpiFormula.avgPaymentDelay') },
    { value: 'fixedExpenseShare', label: this.i18n.t('dashboard.kpiFormula.fixedExpenseShare') },
    { value: 'installmentExpenseShare', label: this.i18n.t('dashboard.kpiFormula.installmentExpenseShare') },
    { value: 'creditUtilization', label: this.i18n.t('dashboard.kpiFormula.creditUtilization') },
    { value: 'mostUsedCard', label: this.i18n.t('dashboard.kpiFormula.mostUsedCard') },
  ]);
  /** Lo que ya ocupa un cupo en la franja -fijo o creado a mano- para no ofrecerlo dos veces. */
  readonly usedKpiFormulas = computed<Set<KpiFormula>>(() => {
    const usados = new Set<KpiFormula>(this.customKpis().map((k) => k.formula));
    if (this.caps.allows(P.dashboard.kpi.balance)) usados.add('amount');
    if (this.caps.allows(P.dashboard.kpi.ingresos)) usados.add('income');
    if (this.caps.allows(P.dashboard.kpi.gastos)) usados.add('expense');
    if (this.caps.allows(P.dashboard.kpi.recuento)) usados.add('count');
    return usados;
  });
  readonly availableKpiFormulaOptions = computed<readonly UiOption[]>(() =>
    this.kpiFormulaOptions().filter((o) => !this.usedKpiFormulas().has(o.value as KpiFormula)),
  );
  protected diasDelPeriodo(): number {
    const inicio = new Date(`${this.range().start}T00:00:00Z`).getTime();
    const fin = new Date(`${this.range().end}T00:00:00Z`).getTime();
    return Math.max(1, Math.round((fin - inicio) / 86_400_000) + 1);
  }
  /**
   * Saldo de cuentas líquidas (ahorro + efectivo): lo que hay a mano de verdad, sin contar
   * cupo de tarjetas. Usa todos los movimientos, no solo los del periodo filtrado -un saldo
   * es una foto de ahora mismo, no la suma de lo que paso en un rango.
   */
  protected disponibleLiquido(): number {
    const movimientos = this.store.data().movements;
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'savings' || a.type === 'cash')
      .reduce((s, a) => s + accountBalance(a, movimientos), 0);
  }
  /** Deuda de tarjetas: solo el lado negativo del saldo -una tarjeta a favor no es deuda. */
  protected deudaTarjetas(): number {
    const movimientos = this.store.data().movements;
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .reduce((s, a) => s + Math.max(0, -accountBalance(a, movimientos)), 0);
  }
  protected cupoTotalTarjetas(): number {
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .reduce((s, a) => s + (a.limit ?? 0), 0);
  }
  /** Suma de gasto (importe negativo) de los movimientos del periodo que cumplen la condición. */
  protected gastoFiltrado(movs: readonly Movement[], cumple: (m: Movement) => boolean): number {
    return movs.filter((m) => m.amount < 0 && cumple(m)).reduce((s, m) => s - m.amount, 0);
  }
  /** Tarjeta de crédito con más movimientos en el periodo -"cuál se usa más", no cuánta deuda tiene. */
  protected tarjetaMasUsada(): { name: string; count: number } | null {
    const conteo = new Map<string, number>();
    for (const m of this.movements()) {
      const cuenta = this.store.account(m.accountId);
      if (cuenta?.type === 'credit') conteo.set(cuenta.id, (conteo.get(cuenta.id) ?? 0) + 1);
    }
    let mejor: { id: string; count: number } | null = null;
    for (const [id, count] of conteo) if (!mejor || count > mejor.count) mejor = { id, count };
    return mejor
      ? { name: this.store.account(mejor.id)?.name ?? this.i18n.t('dashboard.kpi.noCard'), count: mejor.count }
      : null;
  }
  kpiValue(formula: KpiFormula): number {
    const movs = this.movements();
    if (formula === 'savingsRate' || formula === 'expenseShare') {
      const ingreso = this.measureValue(movs, 'income');
      if (ingreso <= 0) return 0;
      const gasto = this.measureValue(movs, 'expense');
      const ahorro = ((ingreso - gasto) / ingreso) * 100;
      return formula === 'savingsRate' ? ahorro : 100 - ahorro;
    }
    if (formula === 'dailyExpense' || formula === 'dailyIncome') {
      const total = this.measureValue(movs, formula === 'dailyExpense' ? 'expense' : 'income');
      return total / this.diasDelPeriodo();
    }
    if (formula === 'liquidityMonths' || formula === 'daysToDeplete') {
      const gastoDiario = this.measureValue(movs, 'expense') / this.diasDelPeriodo();
      if (gastoDiario <= 0) return 0;
      return formula === 'liquidityMonths'
        ? this.disponibleLiquido() / (gastoDiario * 30)
        : this.disponibleLiquido() / gastoDiario;
    }
    if (formula === 'expenseConcentration') return this.categoryDistribution()[0]?.percent ?? 0;
    if (formula === 'debtToIncome') {
      const ingreso = this.measureValue(movs, 'income');
      return ingreso > 0 ? (this.deudaTarjetas() / ingreso) * 100 : 0;
    }
    if (formula === 'avgPaymentDelay') {
      const personas = this.store.data().people.filter((p) => p.averagePaymentDays != null);
      if (!personas.length) return 0;
      return personas.reduce((s, p) => s + (p.averagePaymentDays ?? 0), 0) / personas.length;
    }
    if (formula === 'fixedExpenseShare' || formula === 'installmentExpenseShare') {
      const totalGasto = this.measureValue(movs, 'expense');
      if (totalGasto <= 0) return 0;
      const parcial =
        formula === 'fixedExpenseShare'
          ? this.gastoFiltrado(movs, (m) => !!m.recurring)
          : this.gastoFiltrado(movs, (m) => (m.installmentTotal ?? 1) > 1);
      return (parcial / totalGasto) * 100;
    }
    if (formula === 'creditUtilization') {
      const cupo = this.cupoTotalTarjetas();
      return cupo > 0 ? (this.deudaTarjetas() / cupo) * 100 : 0;
    }
    if (formula === 'mostUsedCard') return this.tarjetaMasUsada()?.count ?? 0;
    return this.measureValue(movs, formula);
  }
  kpiSeriesFor(formula: KpiFormula): number[] {
    if (formula === 'savingsRate' || formula === 'expenseShare') {
      return this.timeline().map((p) => {
        if (p.income <= 0) return 0;
        const ahorro = ((p.income - p.expense) / p.income) * 100;
        return formula === 'savingsRate' ? ahorro : 100 - ahorro;
      });
    }
    if (formula === 'dailyExpense') return this.timeline().map((p) => p.expense);
    if (formula === 'dailyIncome') return this.timeline().map((p) => p.income);
    // Liquidez, deuda y puntualidad son una foto del momento, no un flujo del periodo: no
    // hay una serie honesta que dibujarles, así que sin minigráfica ni variación.
    if (
      formula === 'liquidityMonths' ||
      formula === 'expenseConcentration' ||
      formula === 'debtToIncome' ||
      formula === 'daysToDeplete' ||
      formula === 'avgPaymentDelay' ||
      formula === 'fixedExpenseShare' ||
      formula === 'installmentExpenseShare' ||
      formula === 'creditUtilization' ||
      formula === 'mostUsedCard'
    )
      return [];
    return this.aggregate({ dimension: 'date', measure: formula }).map((a) => a.value);
  }
  kpiTrend(formula: KpiFormula): number | null {
    return this.variacion(this.kpiSeriesFor(formula));
  }
  tendenciaAbs(valor: number): string {
    return Math.abs(valor).toFixed(0);
  }
  /** Dinero para las medidas simples; porcentaje, meses, días o el nombre de una tarjeta para las fórmulas derivadas. */
  kpiFormatValue(formula: KpiFormula, valor: number): string {
    if (formula === 'mostUsedCard') return this.tarjetaMasUsada()?.name ?? this.i18n.t('dashboard.kpi.noData');
    if (
      formula === 'savingsRate' ||
      formula === 'expenseShare' ||
      formula === 'debtToIncome' ||
      formula === 'expenseConcentration' ||
      formula === 'fixedExpenseShare' ||
      formula === 'installmentExpenseShare' ||
      formula === 'creditUtilization'
    )
      return `${valor.toFixed(0)}%`;
    if (formula === 'liquidityMonths') return this.i18n.t('dashboard.unit.months', { value: valor.toFixed(1) });
    if (formula === 'daysToDeplete' || formula === 'avgPaymentDelay')
      return this.i18n.t('dashboard.unit.days', { value: valor.toFixed(0) });
    return this.formatMeasure(valor, {
      measure: formula === 'dailyExpense' ? 'expense' : formula === 'dailyIncome' ? 'income' : formula,
    });
  }
  /** Subtítulo del indicador "tarjeta más usada": cuántos movimientos, ya que el número grande es el nombre. */
  kpiHintFor(formula: KpiFormula): string {
    if (formula === 'mostUsedCard') {
      const top = this.tarjetaMasUsada();
      if (!top) return this.i18n.t('dashboard.kpi.defaultHint');
      const unidad = this.i18n.t(top.count === 1 ? 'dashboard.unit.movement' : 'dashboard.unit.movements');
      return this.i18n.t('dashboard.kpi.mostUsedCard.hint', { count: top.count, unit: unidad });
    }
    return this.i18n.t('dashboard.kpi.defaultHint');
  }
  kpiLabelFor(formula: KpiFormula): string {
    return this.kpiFormulaOptions().find((o) => o.value === formula)?.label ?? '';
  }
  protected readonly formulasDeGasto: readonly KpiFormula[] = [
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
  protected readonly formulasDeIngreso: readonly KpiFormula[] = [
    'income',
    'dailyIncome',
    'savingsRate',
    'liquidityMonths',
    'daysToDeplete',
  ];
  kpiIcon(formula: KpiFormula): IconName {
    if (this.formulasDeIngreso.includes(formula)) return 'trendUp';
    if (this.formulasDeGasto.includes(formula)) return 'trendDown';
    return 'movements';
  }
  kpiTone(formula: KpiFormula): 'accent' | 'success' | 'danger' {
    if (this.formulasDeIngreso.includes(formula)) return 'success';
    if (this.formulasDeGasto.includes(formula)) return 'danger';
    return 'accent';
  }
  /** Si subir esa fórmula es buena noticia; "expenseShare" baja es lo deseable, igual que el gasto. */
  kpiSubirEsBueno(formula: KpiFormula): boolean {
    return !this.formulasDeGasto.includes(formula);
  }
  openKpiCreator(): void {
    const disponibles = this.availableKpiFormulaOptions();
    if (disponibles.length) this.newKpiFormula = disponibles[0].value as KpiFormula;
    this.kpiCreatorOpen.set(true);
  }
  createKpi(event: Event) {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const label = this.newKpiLabel.trim();
    if (!label || this.usedKpiFormulas().has(this.newKpiFormula)) return;
    this.customKpis.update((items) => [...items, { id: `kpi-${Date.now()}`, label, formula: this.newKpiFormula }]);
    this.newKpiLabel = '';
    this.kpiCreatorOpen.set(false);
    this.store.log(this.i18n.t('dashboard.log.indicatorAdded', { label }));
  }
  removeKpi(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.customKpis.update((items) => items.filter((k) => k.id !== id));
  }

  /** Los indicadores propios normalizados a la misma forma que `fixedKpiItems`. */
  readonly customKpiItems = computed(() =>
    this.customKpis().map((kpi) => ({
      id: kpi.id,
      label: kpi.label,
      icon: this.kpiIcon(kpi.formula),
      tone: this.kpiTone(kpi.formula),
      value: this.kpiFormatValue(kpi.formula, this.kpiValue(kpi.formula)),
      hint: this.kpiHintFor(kpi.formula),
      series: this.kpiSeriesFor(kpi.formula),
      delta: this.kpiTrend(kpi.formula),
      subirEsBueno: this.kpiSubirEsBueno(kpi.formula),
    })),
  );
}
