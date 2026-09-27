import { Signal, computed, inject, signal } from '@angular/core';
import { Movement } from '@core/state';
import { PuntoDeFlujo, variacion } from '@shared/historia';
import { P } from '@core/session';
import { sumBy } from '@core/utils';
import { IconName } from '@ui/icon';
import { UiOption } from '@ui/select';
import { Dimension, KpiFormula } from './dashboard.model';
import { DashboardVisuals } from './dashboard-visuals';
import { DashboardLayoutService, KpiDefinition, KpiFilter } from './layout/dashboard-layout.service';
import { KpiRanges, RANGOS_POR_DEFECTO, estadoDe } from './kpis/kpi-ranges';
import { CUSTOM_KPI_PREFIX } from './kpis/kpi-strip/kpi-strip';

export const FORMULAS_FILTRABLES: readonly KpiFormula[] = [
  'amount',
  'income',
  'expense',
  'count',
  'average',
  'savingsRate',
  'expenseShare',
  'dailyExpense',
  'dailyIncome',
];

export const DIMENSIONES_DE_FILTRO: readonly Dimension[] = [
  'category',
  'account',
  'kind',
  'person',
  'recurring',
  'installments',
];

const claveDeKpi = (formula: KpiFormula, filtro?: KpiFilter) =>
  filtro ? `${formula}|${filtro.dimension}|${filtro.value}` : formula;

const FORMULAS_DE_FOTO: readonly KpiFormula[] = [
  'liquidityMonths',
  'debtToIncome',
  'daysToDeplete',
  'avgPaymentDelay',
  'creditUtilization',
  'mostUsedCard',
];

export abstract class DashboardKpis extends DashboardVisuals {
  abstract readonly range: Signal<{ start: string; end: string }>;
  abstract readonly historial: Signal<readonly PuntoDeFlujo[]>;
  abstract readonly historiaEtiqueta: Signal<string>;
  abstract readonly income: Signal<number>;
  abstract readonly expense: Signal<number>;
  protected readonly kpiLayout = inject(DashboardLayoutService);

  rangosDe(id: string, formula: KpiFormula): KpiRanges | null {
    const guardados = this.kpiLayout.ranges();
    if (id in guardados) return guardados[id];
    return RANGOS_POR_DEFECTO[formula] ?? null;
  }

  variacion(serie: readonly number[]): number | null {
    return variacion(serie);
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
  private readonly kpisSembrados: readonly KpiDefinition[] = [
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
  ];
  readonly customKpis = computed(() => this.kpiLayout.definitions() ?? this.kpisSembrados);
  readonly kpiCreatorOpen = signal(false);
  newKpiLabel = '';
  newKpiFormula: KpiFormula = 'income';
  readonly newKpiDimension = signal<Dimension | 'none'>('none');
  newKpiFilterValue = '';
  readonly filterDimensionOptions = computed<readonly UiOption[]>(() => [
    { value: 'none', label: this.i18n.t('dashboard.kpiForm.filter.none') },
    ...DIMENSIONES_DE_FILTRO.map((dimension) => ({
      value: dimension,
      label: this.i18n.t(`dashboard.dimension.${dimension}`),
    })),
  ]);
  readonly filterValueOptions = computed<readonly UiOption[]>(() => {
    const dimension = this.newKpiDimension();
    if (dimension === 'none') return [];
    const valores = new Set(this.store.data().movements.map((m) => this.dimensionKey(m, dimension).label));
    return [...valores].sort((a, b) => a.localeCompare(b)).map((valor) => ({ value: valor, label: valor }));
  });
  readonly usedKpiKeys = computed(
    () =>
      new Set(
        this.customKpis()
          .filter((kpi) => kpi.filter)
          .map((kpi) => claveDeKpi(kpi.formula, kpi.filter)),
      ),
  );
  readonly filterableFormulaOptions = computed<readonly UiOption[]>(() => {
    const dimension = this.newKpiDimension();
    const valor = this.newKpiFilterValue;
    return this.kpiFormulaOptions().filter(
      (opcion) =>
        FORMULAS_FILTRABLES.includes(opcion.value as KpiFormula) &&
        (dimension === 'none' ||
          !valor ||
          !this.usedKpiKeys().has(claveDeKpi(opcion.value as KpiFormula, { dimension, value: valor }))),
    );
  });
  readonly creatorFormulaOptions = computed<readonly UiOption[]>(() =>
    this.newKpiDimension() === 'none' ? this.availableKpiFormulaOptions() : this.filterableFormulaOptions(),
  );
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
    const usados = new Set<KpiFormula>(
      this.customKpis()
        .filter((k) => !k.filter)
        .map((k) => k.formula),
    );
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
    return sumBy(
      this.store
        .data()
        // Todo lo que no es tarjeta: una cuenta corriente, una billetera u otra también son
        // dinero a mano, y antes quedaban fuera por estar agrupadas como ahorro.
        .accounts.filter((a) => a.type !== 'credit'),
      (a) => this.store.balance(a),
    );
  }
  /** Deuda de tarjetas: solo el lado negativo del saldo -una tarjeta a favor no es deuda. */
  protected deudaTarjetas(): number {
    return sumBy(
      this.store.data().accounts.filter((a) => a.type === 'credit'),
      (a) => Math.max(0, -this.store.balance(a)),
    );
  }
  protected cupoTotalTarjetas(): number {
    return sumBy(
      this.store.data().accounts.filter((a) => a.type === 'credit'),
      (a) => a.limit ?? 0,
    );
  }
  /** Suma de gasto (importe negativo) de los movimientos del periodo que cumplen la condición. */
  protected gastoFiltrado(movs: readonly Movement[], cumple: (m: Movement) => boolean): number {
    return sumBy(
      movs.filter((m) => m.amount < 0 && cumple(m)),
      (m) => -m.amount,
    );
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
    const economicos = movs.filter((m) => !m.movementSubtype && m.kind !== 'payment');
    if (formula === 'savingsRate' || formula === 'expenseShare') {
      const ingreso = this.income();
      if (ingreso <= 0) return 0;
      const gasto = this.expense();
      const ahorro = ((ingreso - gasto) / ingreso) * 100;
      return formula === 'savingsRate' ? ahorro : 100 - ahorro;
    }
    if (formula === 'dailyExpense' || formula === 'dailyIncome') {
      const total = formula === 'dailyExpense' ? this.expense() : this.income();
      return total / this.diasDelPeriodo();
    }
    if (formula === 'liquidityMonths' || formula === 'daysToDeplete') {
      const gastoDiario = this.expense() / this.diasDelPeriodo();
      if (gastoDiario <= 0) return 0;
      return formula === 'liquidityMonths'
        ? this.disponibleLiquido() / (gastoDiario * 30)
        : this.disponibleLiquido() / gastoDiario;
    }
    if (formula === 'expenseConcentration') return this.categoryDistribution()[0]?.percent ?? 0;
    if (formula === 'debtToIncome') {
      const ingreso = this.income();
      return ingreso > 0 ? (this.deudaTarjetas() / ingreso) * 100 : 0;
    }
    if (formula === 'avgPaymentDelay') {
      const personas = this.store.data().people.filter((p) => p.averagePaymentDays != null);
      if (!personas.length) return 0;
      return personas.reduce((s, p) => s + (p.averagePaymentDays ?? 0), 0) / personas.length;
    }
    if (formula === 'fixedExpenseShare' || formula === 'installmentExpenseShare') {
      const totalGasto = this.expense();
      if (totalGasto <= 0) return 0;
      const parcial =
        formula === 'fixedExpenseShare'
          ? this.gastoFiltrado(economicos, (m) => !!m.recurring)
          : this.gastoFiltrado(economicos, (m) => (m.installmentTotal ?? 1) > 1);
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
    if (FORMULAS_DE_FOTO.includes(formula)) return [];
    const historia = this.historial();
    const dias = (p: PuntoDeFlujo) =>
      Math.max(
        1,
        Math.round(
          (new Date(`${p.rango.end}T00:00:00Z`).getTime() - new Date(`${p.rango.start}T00:00:00Z`).getTime()) /
            86_400_000,
        ) + 1,
      );
    const porPunto = (p: PuntoDeFlujo): number | null => {
      if (formula === 'amount') return p.net;
      if (formula === 'income') return p.income;
      if (formula === 'expense') return p.expense;
      if (formula === 'savingsRate') return p.income > 0 ? ((p.income - p.expense) / p.income) * 100 : null;
      if (formula === 'expenseShare') return p.income > 0 ? (p.expense / p.income) * 100 : null;
      if (formula === 'dailyExpense') return p.expense / dias(p);
      if (formula === 'dailyIncome') return p.income / dias(p);
      if (!p.movs) return null;
      if (formula === 'count' || formula === 'average') return this.measureValue(p.movs, formula);
      const economicos = p.movs.filter((m) => !m.movementSubtype && m.kind !== 'payment');
      const gasto = this.measureValue(economicos, 'expense');
      if (gasto <= 0) return 0;
      if (formula === 'fixedExpenseShare') return (this.gastoFiltrado(economicos, (m) => !!m.recurring) / gasto) * 100;
      if (formula === 'installmentExpenseShare')
        return (this.gastoFiltrado(economicos, (m) => (m.installmentTotal ?? 1) > 1) / gasto) * 100;
      if (formula === 'expenseConcentration') {
        const porCategoria = new Map<string, number>();
        for (const m of economicos)
          if (m.amount < 0) porCategoria.set(m.category, (porCategoria.get(m.category) ?? 0) - m.amount);
        return (Math.max(0, ...porCategoria.values()) / gasto) * 100;
      }
      return null;
    };
    const valores = historia.map(porPunto);
    return valores.every((valor) => valor === null) ? [] : valores.map((valor) => valor ?? 0);
  }
  private cumpleFiltro(m: Movement, filtro: KpiFilter): boolean {
    return this.dimensionKey(m, filtro.dimension).label === filtro.value;
  }
  private valorSobre(formula: KpiFormula, movs: readonly Movement[], dias: number): number {
    const economicos = movs.filter((m) => !m.movementSubtype && m.kind !== 'payment');
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
    if (formula === 'amount' || formula === 'count' || formula === 'average') return this.measureValue(movs, formula);
    return 0;
  }
  private diasDe(rango: { start: string; end: string }): number {
    const inicio = new Date(`${rango.start}T00:00:00Z`).getTime();
    const fin = new Date(`${rango.end}T00:00:00Z`).getTime();
    return Math.max(1, Math.round((fin - inicio) / 86_400_000) + 1);
  }
  kpiValueDe(kpi: KpiDefinition): number {
    const filtro = kpi.filter;
    if (!filtro) return this.kpiValue(kpi.formula);
    return this.valorSobre(
      kpi.formula,
      this.movements().filter((m) => this.cumpleFiltro(m, filtro)),
      this.diasDelPeriodo(),
    );
  }
  kpiSeriesDe(kpi: KpiDefinition): number[] {
    const filtro = kpi.filter;
    if (!filtro) return this.kpiSeriesFor(kpi.formula);
    const historia = this.historial();
    if (historia.some((punto) => !punto.movs)) return [];
    return historia.map((punto) =>
      this.valorSobre(
        kpi.formula,
        (punto.movs ?? []).filter((m) => this.cumpleFiltro(m, filtro)),
        this.diasDe(punto.rango),
      ),
    );
  }
  kpiStatusFor(id: string, formula: KpiFormula, valor = this.kpiValue(formula)) {
    if (formula === 'mostUsedCard') return null;
    return estadoDe(valor, this.rangosDe(id, formula));
  }
  kpiProgressFor(formula: KpiFormula): number | null {
    const porcentajes: readonly KpiFormula[] = [
      'savingsRate',
      'expenseShare',
      'debtToIncome',
      'expenseConcentration',
      'fixedExpenseShare',
      'installmentExpenseShare',
      'creditUtilization',
    ];
    if (!porcentajes.includes(formula)) return null;
    return Math.max(0, Math.min(100, this.kpiValue(formula)));
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
  private readonly iconoPorFormula: Partial<Record<KpiFormula, IconName>> = {
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

  kpiIcon(formula: KpiFormula): IconName {
    return this.iconoPorFormula[formula] ?? 'movements';
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
    const dimension = this.newKpiDimension();
    const filtro: KpiFilter | undefined =
      dimension !== 'none' && this.newKpiFilterValue ? { dimension, value: this.newKpiFilterValue } : undefined;
    if (!label || (dimension !== 'none' && !filtro)) return;
    if (
      filtro
        ? this.usedKpiKeys().has(claveDeKpi(this.newKpiFormula, filtro))
        : this.usedKpiFormulas().has(this.newKpiFormula)
    )
      return;
    if (filtro && !FORMULAS_FILTRABLES.includes(this.newKpiFormula)) return;
    this.kpiLayout.saveDefinitions([
      ...this.customKpis(),
      { id: `kpi-${Date.now()}`, label, formula: this.newKpiFormula, ...(filtro ? { filter: filtro } : {}) },
    ]);
    this.newKpiLabel = '';
    this.newKpiDimension.set('none');
    this.newKpiFilterValue = '';
    this.kpiCreatorOpen.set(false);
    this.store.log(this.i18n.t('dashboard.log.indicatorAdded', { label }));
  }
  removeKpi(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.kpiLayout.saveDefinitions(this.customKpis().filter((k) => k.id !== id));
  }

  /** Los indicadores propios normalizados a la misma forma que `fixedKpiItems`. */
  readonly customKpiItems = computed(() =>
    this.customKpis().map((kpi) => {
      const valor = this.kpiValueDe(kpi);
      const serie = this.kpiSeriesDe(kpi);
      const filtro = kpi.filter;
      return {
        id: kpi.id,
        label: kpi.label,
        icon: this.kpiIcon(kpi.formula),
        tone: this.kpiTone(kpi.formula),
        value: this.kpiFormatValue(kpi.formula, valor),
        hint: filtro
          ? `${this.i18n.t(`dashboard.dimension.${filtro.dimension}`)}: ${filtro.value}`
          : this.kpiHintFor(kpi.formula),
        series: serie,
        delta: this.variacion(serie),
        subirEsBueno: this.kpiSubirEsBueno(kpi.formula),
        progress: filtro ? null : this.kpiProgressFor(kpi.formula),
        status: this.kpiStatusFor(CUSTOM_KPI_PREFIX + kpi.id, kpi.formula, valor),
        caption: serie.length > 1 ? this.historiaEtiqueta() : '',
        formula: kpi.formula,
        ranges: this.rangosDe(CUSTOM_KPI_PREFIX + kpi.id, kpi.formula),
      };
    }),
  );
}
