import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '../../core/api-client';
import { accountBalance, Movement } from '../../core/demo-data';
import { I18nService } from '../../core/i18n';
import { parseMoney, sumBy } from '../../core/money';
import { P } from '../../core/permissions';
import { sincronizarConLaUrl } from '../../core/url-state';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { IconComponent, IconName } from '../../ui/icon';
import { DataTableComponent, KpiComponent, OverlayComponent } from '../../ui/ui';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { ChartComponent, ChartOption } from '../../ui/chart';
import { ChartThemeService } from '../../ui/chart-theme';

type Scale = 'day' | 'week' | 'month' | 'year';
/**
 * Los nueve primeros son fijos: cada uno trae su propia lógica de datos (ingresos vs
 * gastos, categorías con click-to-filter, dispersión fecha/importe...) y no aceptan
 * dimension/measure. Los que siguen son genéricos: cualquier combinación de dimensión y
 * métrica pasa por `aggregate`/`aggregate2D` y `widgetOption`, que es lo que hace posible
 * "crear un widget nuevo eligiendo qué medir" en vez de una lista cerrada de graficas.
 */
type FixedWidgetType =
  | 'flow'
  | 'trend'
  | 'categories'
  | 'accounts'
  | 'scatter'
  | 'donut'
  | 'stacked'
  | 'heatmap'
  | 'gauge'
  | 'histogram';
type GenericWidgetType =
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
type WidgetType = FixedWidgetType | GenericWidgetType;
/** Eje / agrupación disponible para un widget genérico. */
type Dimension = 'category' | 'account' | 'date' | 'kind' | 'person' | 'recurring' | 'installments';
/** Qué se mide dentro de cada grupo de la dimensión. */
type Measure = 'amount' | 'expense' | 'income' | 'count' | 'average';
/**
 * Las cinco medidas simples, mas formulas que cruzan ingreso y gasto -solo para la franja
 * de KPI de arriba, no para los widgets del grid, que ya tienen su propio motor de
 * dimension/medida.
 */
type KpiFormula =
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
type Widget = {
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
};
const GENERIC_TYPES: readonly GenericWidgetType[] = [
  'line',
  'area',
  'bar',
  'barH',
  'grouped',
  'stackedBars',
  'stacked100',
  'pie',
  'treemap',
  'funnel',
  'waterfall',
  'card',
  'matrix',
  'table',
  'indicator',
  'colorScale',
  'statusBars',
];
const TWO_DIMENSION_TYPES: readonly WidgetType[] = ['grouped', 'stackedBars', 'stacked100', 'matrix'];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ChartComponent,
    KpiComponent,
    DataTableComponent,
    OverlayComponent,
    IconComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  readonly P = P;
  private readonly api = inject(FinanceApiClient);
  readonly store = inject(DemoStore);
  readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  private readonly temaGrafica = inject(ChartThemeService);
  readonly customizing = signal(false);

  /**
   * Personalizar agrupa cuatro acciones distintas: reordenar, cambiar de tipo, ocultar
   * y crear. El botón aparece si alguna está concedida, y dentro cada control comprueba
   * la suya. Así se puede dar «solo reorganizar» sin dar «cambiar de visualización».
   */
  readonly puedePersonalizar = computed(
    () =>
      this.caps.allows(P.dashboard.widget.orden.editar) ||
      this.caps.allows(P.dashboard.widget.tipo.editar) ||
      this.caps.allows(P.dashboard.widget.deshabilitar) ||
      this.caps.allows(P.dashboard.widget.crear),
  );

  /** Sin ningún KPI concedido la franja se retira entera, en vez de quedar vacía. */
  readonly algunKpi = computed(
    () =>
      this.caps.allows(P.dashboard.kpi.balance) ||
      this.caps.allows(P.dashboard.kpi.ingresos) ||
      this.caps.allows(P.dashboard.kpi.gastos) ||
      this.caps.allows(P.dashboard.kpi.recuento) ||
      (this.customKpis().length > 0 && this.caps.allows(P.dashboard.widget.propios)),
  );
  /**
   * Si no hay ni una pieza concedida, el panel no tiene nada que pintar.
   *
   * Es lo único que decide entre la pantalla y la explicación. Antes decidía
   * `dashboard.listar`, un permiso aparte que había que marcar además del de entrar:
   * conceder «ver dashboard» y un KPI pintaba la explicación y escondía el KPI, que era
   * justo lo que se había concedido. Cada pieza responde ahora por sí sola.
   */
  readonly nadaQueMostrar = computed(
    () =>
      !this.algunKpi() && !this.algunWidget() && !this.caps.allows(P.dashboard.tabla.ver) && !this.puedePersonalizar(),
  );

  /** Igual que los KPI: sin ninguna gráfica concedida, la rejilla no se pinta. */
  readonly algunWidget = computed(() =>
    [
      P.dashboard.widget.flujo,
      P.dashboard.widget.categorias,
      P.dashboard.widget.cuentas,
      P.dashboard.widget.tendencia,
      P.dashboard.widget.compromisos,
      P.dashboard.widget.salud,
      P.dashboard.widget.propios,
    ].some((codigo) => this.caps.allows(codigo)),
  );

  readonly scale = signal<Scale>('month');
  readonly anchor = signal('2026-08-31');
  /**
   * Saltar de año a golpe de "‹"/"›" es razonable entre meses vecinos, pero no para ir de
   * 2026 a 1999: son mas de trescientos clics. El selector deja escribir el destino
   * directamente, sin ser el `<input type=date>` del sistema -que no encaja con el resto
   * de controles de la app-, con un `demo-select` como todos los otros filtros.
   */
  readonly periodPickerOpen = signal(false);
  readonly anchorYear = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getFullYear()));
  readonly anchorMonth = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getMonth()));
  readonly anchorDay = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getDate()));
  /** Días del mes/año que muestra el selector: 28-31 según el mes, sin inventar un 31 de febrero. */
  /** Días que tiene el mes del ancla; también el máximo válido para el selector de Día. */
  readonly daysInAnchorMonth = computed(() => new Date(Number(this.anchorYear()), Number(this.anchorMonth()) + 1, 0).getDate());
  /**
   * Semanas del mes en bloques fijos de 7 dias (1-7, 8-14...): no son semanas ISO -esas
   * cruzan de un mes a otro y "semana 1 de enero" dejaria de significar lo mismo para
   * quien solo quiere saltar al principio del mes-, pero alcanzan para lo que se pide:
   * elegir "la primera semana de enero" sin tener que dar clic semana a semana.
   */
  readonly weekOfMonthOptions = computed<readonly UiOption[]>(() => {
    const total = this.daysInAnchorMonth();
    const semanas: UiOption[] = [];
    for (let inicio = 1, n = 1; inicio <= total; inicio += 7, n++) {
      const fin = Math.min(inicio + 6, total);
      semanas.push({
        value: String(inicio),
        label: this.i18n.t('dashboard.filters.period.weekOption', { n, start: inicio, end: fin }),
      });
    }
    return semanas;
  });
  /** Qué opción de `weekOfMonthOptions` contiene el día actual del ancla. */
  readonly anchorWeekOfMonth = computed(() => {
    const dia = Number(this.anchorDay());
    return String(Math.floor((dia - 1) / 7) * 7 + 1);
  });
  setWeekOfMonth(value: string) {
    this.setDay(value);
  }
  /** Nombres de mes según el idioma activo -mismo `Intl` que ya usa el resto del archivo para fechas. */
  readonly monthOptions = computed<readonly UiOption[]>(() => {
    const formateador = new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i),
      label: formateador.format(new Date(Date.UTC(2026, i, 1))),
    }));
  });
  /**
   * Solo digitos, a proposito: `<input type=number>` deja escribir "-" y "e" -notacion
   * cientifica, 1e5 es un numero valido para el navegador-, y ni un año negativo ni "2e26"
   * tienen sentido aqui. `Number(value)` los aceptaria igual, asi que la guardia va antes,
   * sobre el texto crudo.
   */
  private soloDigitos(value: string): number | null {
    const limpio = value.trim();
    return /^\d+$/.test(limpio) ? Number(limpio) : null;
  }
  setYear(value: string) {
    const year = this.soloDigitos(value);
    if (year === null || year < 1) return;
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setFullYear(year);
    this.anchor.set(this.iso(d));
  }
  setMonth(value: string) {
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setMonth(Number(value));
    this.anchor.set(this.iso(d));
  }
  setDay(value: string) {
    const day = this.soloDigitos(value);
    if (day === null || day < 1) return;
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setDate(Math.min(day, this.daysInAnchorMonth()));
    this.anchor.set(this.iso(d));
  }
  readonly accountId = signal('all');
  readonly accountType = signal('all');
  readonly globalCategory = signal('all');
  readonly localCategory = signal('all');

  /**
   * Los filtros viven en la URL: una vista del dashboard se puede compartir y sobrevive
   * a una recarga. `localCategory` queda fuera a propósito — es la exploración de un
   * widget, no el contexto de la pantalla, y se promueve con «aplicar a todo».
   */
  private readonly urlDelDashboard = [
    sincronizarConLaUrl('escala', this.scale, 'month', (v) => ['day', 'week', 'month', 'year'].includes(v)),
    sincronizarConLaUrl('fecha', this.anchor, '2026-08-31', (v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
    sincronizarConLaUrl('cuenta', this.accountId, 'all'),
    sincronizarConLaUrl('tipo', this.accountType, 'all', (v) => ['all', 'credit', 'savings', 'cash'].includes(v)),
    sincronizarConLaUrl('categoria', this.globalCategory, 'all'),
  ];
  readonly hiddenIds = signal<string[]>([]);
  readonly widgetCreatorOpen = signal(false);
  newWidgetTitle = '';
  newWidgetMetric: WidgetType = 'bar';
  newWidgetWidth = 'wide';
  newWidgetDimension: Dimension = 'category';
  newWidgetDimension2: Dimension = 'kind';
  newWidgetMeasure: Measure = 'expense';
  newWidgetGoalMin = 0;
  newWidgetGoalTarget = 0;
  newWidgetGoalMax = 0;
  readonly accountTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.accountType.all') },
    { value: 'credit', label: this.i18n.t('dashboard.accountType.credit.plural') },
    { value: 'savings', label: this.i18n.t('dashboard.accountType.savings.plural') },
    { value: 'cash', label: this.i18n.t('dashboard.accountType.cash') },
  ]);
  /**
   * Los primeros catorce son genéricos: se combinan con dimensión + métrica (ver
   * `isGeneric`) para que un widget "sea lo que el usuario quiera medir", en vez de una
   * grafica ya calculada. Los marcados "(fijo)" traen su propia lógica de datos —flujo de
   * caja, exploración de categorías con click-to-filter, dispersión fecha/importe— y no
   * aceptan dimensión ni métrica; se mantienen para no romper widgets ya creados con ellos.
   */
  readonly widgetTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'line', label: this.i18n.t('dashboard.widgetType.line') },
    { value: 'area', label: this.i18n.t('dashboard.widgetType.area') },
    { value: 'bar', label: this.i18n.t('dashboard.widgetType.bar') },
    { value: 'barH', label: this.i18n.t('dashboard.widgetType.barH') },
    { value: 'grouped', label: this.i18n.t('dashboard.widgetType.grouped') },
    { value: 'stackedBars', label: this.i18n.t('dashboard.widgetType.stackedBars') },
    { value: 'stacked100', label: this.i18n.t('dashboard.widgetType.stacked100') },
    { value: 'pie', label: this.i18n.t('dashboard.widgetType.pie') },
    { value: 'treemap', label: this.i18n.t('dashboard.widgetType.treemap') },
    { value: 'funnel', label: this.i18n.t('dashboard.widgetType.funnel') },
    { value: 'waterfall', label: this.i18n.t('dashboard.widgetType.waterfall') },
    { value: 'matrix', label: this.i18n.t('dashboard.widgetType.matrix') },
    { value: 'card', label: this.i18n.t('dashboard.widgetType.card') },
    { value: 'indicator', label: this.i18n.t('dashboard.widgetType.indicator') },
    { value: 'colorScale', label: this.i18n.t('dashboard.widgetType.colorScale') },
    { value: 'statusBars', label: this.i18n.t('dashboard.widgetType.statusBars') },
    { value: 'table', label: this.i18n.t('dashboard.widgetType.table') },
    { value: 'flow', label: this.i18n.t('dashboard.widgetType.flow') },
    { value: 'trend', label: this.i18n.t('dashboard.widgetType.trend') },
    { value: 'categories', label: this.i18n.t('dashboard.widgetType.categories') },
    { value: 'accounts', label: this.i18n.t('dashboard.widgetType.accounts') },
    { value: 'scatter', label: this.i18n.t('dashboard.widgetType.scatter') },
    { value: 'donut', label: this.i18n.t('dashboard.widgetType.donut') },
    { value: 'stacked', label: this.i18n.t('dashboard.widgetType.stacked') },
    { value: 'heatmap', label: this.i18n.t('dashboard.widgetType.heatmap') },
    { value: 'gauge', label: this.i18n.t('dashboard.widgetType.gauge') },
    { value: 'histogram', label: this.i18n.t('dashboard.widgetType.histogram') },
  ]);
  readonly dimensionOptions = computed<readonly UiOption[]>(() => [
    { value: 'category', label: this.i18n.t('dashboard.dimension.category') },
    { value: 'account', label: this.i18n.t('dashboard.dimension.account') },
    { value: 'date', label: this.i18n.t('dashboard.dimension.date') },
    { value: 'kind', label: this.i18n.t('dashboard.dimension.kind') },
    { value: 'person', label: this.i18n.t('dashboard.dimension.person') },
    { value: 'recurring', label: this.i18n.t('dashboard.dimension.recurring') },
    { value: 'installments', label: this.i18n.t('dashboard.dimension.installments') },
  ]);
  readonly measureOptions = computed<readonly UiOption[]>(() => [
    { value: 'expense', label: this.i18n.t('dashboard.measure.expense') },
    { value: 'income', label: this.i18n.t('dashboard.measure.income') },
    { value: 'amount', label: this.i18n.t('dashboard.measure.amount') },
    { value: 'count', label: this.i18n.t('dashboard.measure.count') },
    { value: 'average', label: this.i18n.t('dashboard.measure.average') },
  ]);
  readonly widgetWidthOptions = computed<readonly UiOption[]>(() => [
    { value: 'wide', label: this.i18n.t('dashboard.widgetWidth.wide') },
    { value: 'half', label: this.i18n.t('dashboard.widgetWidth.half') },
  ]);
  isGeneric(type: WidgetType): boolean {
    return (GENERIC_TYPES as readonly WidgetType[]).includes(type);
  }
  needsDimension2(type: WidgetType): boolean {
    return TWO_DIMENSION_TYPES.includes(type);
  }
  needsGoal(type: WidgetType): boolean {
    return type === 'indicator' || type === 'colorScale';
  }
  readonly scales = computed<{ value: Scale; label: string }[]>(() => [
    { value: 'day', label: this.i18n.t('dashboard.period.day') },
    { value: 'week', label: this.i18n.t('dashboard.period.week') },
    { value: 'month', label: this.i18n.t('dashboard.period.month') },
    { value: 'year', label: this.i18n.t('dashboard.period.year') },
  ]);
  readonly all = signal<Widget[]>([
    {
      id: 'flow',
      title: this.i18n.t('dashboard.widget.flow.title'),
      kicker: this.i18n.t('dashboard.widget.flow.kicker'),
      type: 'flow',
      wide: true,
      capability: P.dashboard.widget.flujo,
    },
    {
      id: 'categories',
      title: this.i18n.t('dashboard.widget.categories.title'),
      kicker: this.i18n.t('dashboard.widget.categories.kicker'),
      type: 'categories',
      wide: false,
      capability: P.dashboard.widget.categorias,
    },
    {
      id: 'accounts',
      title: this.i18n.t('dashboard.widget.accounts.title'),
      kicker: this.i18n.t('dashboard.widget.accounts.kicker'),
      type: 'accounts',
      wide: false,
      capability: P.dashboard.widget.cuentas,
    },
    {
      id: 'trend',
      title: this.i18n.t('dashboard.widget.trend.title'),
      kicker: this.i18n.t('dashboard.widget.trend.kicker'),
      type: 'trend',
      wide: true,
      capability: P.dashboard.widget.tendencia,
    },
    {
      /*
       * Antes tenia `type: 'accounts'`, el mismo tipo que el widget "accounts" de arriba:
       * ambos caian en el mismo @case del template y mostraban exactamente lo mismo. Con
       * el motor generico cada widget trae su propia dimension/medida.
       */
      id: 'commitments',
      title: this.i18n.t('dashboard.widget.commitments.title'),
      kicker: this.i18n.t('dashboard.widget.commitments.kicker'),
      type: 'bar',
      dimension: 'account',
      measure: 'amount',
      wide: false,
      capability: P.dashboard.widget.compromisos,
    },
    {
      // Mismo caso que "commitments": tenia `type: 'categories'`, duplicando ese widget.
      id: 'health',
      title: this.i18n.t('dashboard.widget.health.title'),
      kicker: this.i18n.t('dashboard.widget.health.kicker'),
      type: 'bar',
      dimension: 'category',
      measure: 'average',
      wide: false,
      capability: P.dashboard.widget.salud,
    },
    /*
     * Galería: un widget por cada tipo de grafica que el motor sabe dibujar, para que el
     * usuario de prueba vea de un vistazo todo el catalogo (genericos + fijos) sin tener
     * que abrir "Crear widget" veinte veces. Sin `capability` -heredan
     * `dashboard.widget.propios`, igual que cualquier widget que alguien cree a mano.
     */
    {
      id: 'g-line',
      title: this.i18n.t('dashboard.widget.gallery.line.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'line',
      dimension: 'date',
      measure: 'income',
      wide: false,
    },
    {
      id: 'g-area',
      title: this.i18n.t('dashboard.widget.gallery.area.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'area',
      dimension: 'date',
      measure: 'expense',
      wide: false,
    },
    {
      id: 'g-barh',
      title: this.i18n.t('dashboard.widget.gallery.barH.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'barH',
      dimension: 'category',
      measure: 'count',
      wide: false,
    },
    {
      id: 'g-grouped',
      title: this.i18n.t('dashboard.widget.gallery.grouped.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'grouped',
      dimension: 'category',
      dimension2: 'kind',
      measure: 'amount',
      wide: true,
    },
    {
      id: 'g-stacked-bars',
      title: this.i18n.t('dashboard.widget.gallery.stackedBars.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'stackedBars',
      dimension: 'account',
      dimension2: 'kind',
      measure: 'amount',
      wide: true,
    },
    {
      id: 'g-stacked100',
      title: this.i18n.t('dashboard.widget.gallery.stacked100.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'stacked100',
      dimension: 'category',
      dimension2: 'kind',
      measure: 'count',
      wide: true,
    },
    {
      id: 'g-pie',
      title: this.i18n.t('dashboard.widget.gallery.pie.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'pie',
      dimension: 'account',
      measure: 'count',
      wide: false,
    },
    {
      id: 'g-treemap',
      title: this.i18n.t('dashboard.widget.gallery.treemap.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'treemap',
      dimension: 'category',
      measure: 'expense',
      wide: false,
    },
    {
      id: 'g-funnel',
      title: this.i18n.t('dashboard.widget.gallery.funnel.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'funnel',
      dimension: 'category',
      measure: 'expense',
      wide: false,
    },
    {
      id: 'g-waterfall',
      title: this.i18n.t('dashboard.widget.gallery.waterfall.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'waterfall',
      dimension: 'date',
      measure: 'amount',
      wide: true,
    },
    {
      id: 'g-card',
      title: this.i18n.t('dashboard.widget.gallery.card.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'card',
      measure: 'income',
      wide: false,
    },
    {
      id: 'g-matrix',
      title: this.i18n.t('dashboard.widget.gallery.matrix.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'matrix',
      dimension: 'category',
      dimension2: 'kind',
      measure: 'count',
      wide: true,
    },
    {
      id: 'g-table',
      title: this.i18n.t('dashboard.widget.gallery.table.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'table',
      dimension: 'person',
      measure: 'amount',
      wide: false,
    },
    {
      id: 'g-indicator',
      title: this.i18n.t('dashboard.widget.gallery.indicator.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'indicator',
      measure: 'expense',
      goalMin: 0,
      goalTarget: 3000000,
      goalMax: 5000000,
      wide: false,
    },
    {
      id: 'g-scatter',
      title: this.i18n.t('dashboard.widget.gallery.scatter.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'scatter',
      wide: true,
    },
    {
      id: 'g-donut',
      title: this.i18n.t('dashboard.widget.gallery.donut.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'donut',
      wide: false,
    },
    {
      id: 'g-stacked',
      title: this.i18n.t('dashboard.widget.gallery.stacked.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'stacked',
      wide: true,
    },
    {
      id: 'g-heatmap',
      title: this.i18n.t('dashboard.widget.gallery.heatmap.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'heatmap',
      wide: true,
    },
    {
      id: 'g-gauge',
      title: this.i18n.t('dashboard.widget.gallery.gauge.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'gauge',
      wide: false,
    },
    {
      id: 'g-histogram',
      title: this.i18n.t('dashboard.widget.gallery.histogram.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'histogram',
      wide: false,
    },
    {
      id: 'g-colorscale',
      title: this.i18n.t('dashboard.widget.gallery.colorScale.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'colorScale',
      measure: 'expense',
      goalMin: 0,
      goalTarget: 3000000,
      goalMax: 5000000,
      wide: false,
    },
    {
      id: 'g-statusbars',
      title: this.i18n.t('dashboard.widget.gallery.statusBars.title'),
      kicker: this.i18n.t('dashboard.widget.gallery.kicker'),
      type: 'statusBars',
      dimension: 'category',
      measure: 'expense',
      wide: false,
    },
  ]);
  canSee(widget: Widget): boolean {
    // Antes, un widget sin capacidad era visible para cualquiera, y los creados por
    // el usuario nacian asi. Ahora heredan el permiso de los widgets propios.
    return this.caps.allows(widget.capability ?? P.dashboard.widget.propios);
  }
  readonly widgets = computed(() => this.all().filter((w) => !this.hiddenIds().includes(w.id) && this.canSee(w)));
  readonly hidden = computed(() => this.all().filter((w) => this.hiddenIds().includes(w.id) && this.canSee(w)));
  readonly allCategories = computed(() => [...new Set(this.store.data().movements.map((m) => m.category))].sort());
  readonly accountOptions = computed(() =>
    this.store.data().accounts.filter((a) => this.accountType() === 'all' || a.type === this.accountType()),
  );
  readonly accountSelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allAccounts') },
    ...this.accountOptions().map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly categorySelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allCategories') },
    ...this.allCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly localCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allLocal') },
    ...this.localOptions().map((category) => ({ value: category, label: category })),
  ]);
  readonly range = computed(() => {
    const a = new Date(`${this.anchor()}T12:00:00`);
    let start: Date, end: Date;
    if (this.scale() === 'day') {
      start = new Date(a);
      end = new Date(a);
    } else if (this.scale() === 'week') {
      const offset = (a.getDay() + 6) % 7;
      start = new Date(a);
      start.setDate(a.getDate() - offset);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (this.scale() === 'month') {
      start = new Date(a.getFullYear(), a.getMonth(), 1, 12);
      end = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
    } else {
      start = new Date(a.getFullYear(), 0, 1, 12);
      end = new Date(a.getFullYear(), 11, 31, 12);
    }
    return { start: this.iso(start), end: this.iso(end) };
  });
  readonly periodLabel = computed(() => {
    const f = (v: string) =>
      new Intl.DateTimeFormat(this.store.preferences().locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${v}T12:00:00Z`));
    return `${f(this.range().start)} – ${f(this.range().end)}`;
  });
  readonly periodShortLabel = computed(() => {
    const options: Intl.DateTimeFormatOptions =
      this.scale() === 'year'
        ? { year: 'numeric' }
        : this.scale() === 'month'
          ? { month: 'long', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(this.store.preferences().locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${this.anchor()}T12:00:00Z`),
    );
  });
  /**
   * Cifras del periodo calculadas por el servidor.
   *
   * El contrato de DashboardDto lo dice: «el cliente no suma saldos ni deduce deudas por
   * su cuenta». Hasta ahora esta pantalla lo incumplia porque calculaba sobre la pagina
   * de 25 movimientos del arranque, asi que sus numeros describian esa pagina y no el
   * periodo. En modo demo no hay servidor y se sigue calculando en local.
   */
  readonly remote = signal<ApiDashboard | null>(null);

  private readonly cargaRemota = effect(() => {
    const rango = this.range();
    if (this.store.runtime.mode !== 'api' || this.nadaQueMostrar()) return;
    void firstValueFrom(this.api.dashboard(rango.start, rango.end))
      .then((valor) => this.remote.set(valor))
      .catch(() => this.remote.set(null));
  });

  readonly base = computed(() =>
    this.store.data().movements.filter((m) => {
      const a = this.store.account(m.accountId);
      return (
        m.date >= this.range().start &&
        m.date <= this.range().end &&
        (this.accountId() === 'all' || m.accountId === this.accountId()) &&
        (this.accountType() === 'all' || a?.type === this.accountType())
      );
    }),
  );
  readonly localOptions = computed(() =>
    [
      ...new Set(
        this.base()
          .filter((m) => m.kind === 'expense')
          .map((m) => m.category),
      ),
    ].sort(),
  );
  readonly movements = computed(() =>
    this.base().filter((m) => this.globalCategory() === 'all' || m.category === this.globalCategory()),
  );
  readonly income = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.income);
    return sumBy(
      this.movements().filter((m) => m.kind === 'income'),
      (m) => Math.max(0, m.amount),
    );
  });
  readonly expense = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.expense);
    return sumBy(
      this.movements().filter((m) => m.kind === 'expense'),
      (m) => -Math.min(0, m.amount),
    );
  });
  readonly net = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.net);
    return sumBy(this.movements(), (m) => m.amount);
  });

  /**
   * El servidor no conoce los filtros locales de cuenta, tipo o categoria. Mientras
   * haya alguno activo, la cifra del servidor no responde a lo que el usuario ve, asi
   * que manda el calculo local sobre lo cargado. Sin filtros, manda el servidor.
   */
  private readonly remoteAplicable = computed(() => {
    const sinFiltrosLocales =
      this.accountId() === 'all' && this.accountType() === 'all' && this.globalCategory() === 'all';
    const remoto = this.remote();
    return sinFiltrosLocales && remoto && remoto.period.period.start === this.range().start ? remoto : null;
  });
  readonly timeline = computed(() => {
    const remoto = this.remoteAplicable();
    const puntos = remoto
      ? remoto.series.map((punto) => ({
          date: punto.date,
          income: parseMoney(punto.income),
          expense: parseMoney(punto.expense),
        }))
      : this.movements().map((m) => ({
          date: m.date,
          income: m.kind === 'income' && m.amount > 0 ? m.amount : 0,
          expense: m.kind === 'expense' && m.amount < 0 ? -m.amount : 0,
        }));
    const map = new Map<string, { key: string; label: string; income: number; expense: number }>();
    for (const m of puntos) {
      const d = new Date(`${m.date}T12:00:00Z`),
        key = this.scale() === 'year' ? m.date.slice(0, 7) : m.date,
        label =
          this.scale() === 'year'
            ? new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'short', timeZone: 'UTC' }).format(d)
            : new Intl.DateTimeFormat(this.store.preferences().locale, {
                day: '2-digit',
                month: 'short',
                timeZone: 'UTC',
              }).format(d),
        p = map.get(key) ?? { key, label, income: 0, expense: 0 };
      p.income += m.income;
      p.expense += m.expense;
      map.set(key, p);
    }
    const values = [...map.values()].sort((a, b) => a.key.localeCompare(b.key)),
      max = Math.max(1, ...values.flatMap((v) => [v.income, v.expense]));
    return values.map((v) => ({ ...v, incomeP: (v.income / max) * 100, expenseP: (v.expense / max) * 100 }));
  });
  readonly categoryDistribution = computed(() => {
    const totals = new Map<string, number>();
    for (const m of this.movements())
      if (
        m.kind === 'expense' &&
        m.amount < 0 &&
        (this.localCategory() === 'all' || m.category === this.localCategory())
      )
        totals.set(m.category, (totals.get(m.category) ?? 0) - m.amount);
    const total = [...totals.values()].reduce((s, v) => s + v, 0),
      colors = ['#4f46e5', '#e11d48', '#d97706', '#0ea5e9', '#0d9488', '#64748b'];
    return [...totals]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        percent: Math.round((value / Math.max(1, total)) * 100),
        color: colors[i % colors.length],
      }));
  });
  readonly accountDistribution = computed(() =>
    this.accountOptions()
      .map((a) => ({
        ...a,
        amount: -this.movements()
          .filter((m) => m.accountId === a.id && m.kind === 'expense' && m.amount < 0)
          .reduce((s, m) => s + m.amount, 0),
      }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  );
  readonly serieIngresos = computed(() => this.timeline().map((p) => p.income));
  readonly serieGastos = computed(() => this.timeline().map((p) => p.expense));
  readonly serieNeta = computed(() => this.timeline().map((p) => p.income - p.expense));

  /**
   * Variacion del ultimo intervalo frente al anterior, en tanto por ciento.
   *
   * Con menos de dos intervalos, o si el anterior fue cero, no hay comparacion honesta
   * que hacer y la tarjeta no ensena ninguna: un «+100 %» sobre cero no informa de nada.
   */
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
  private diasDelPeriodo(): number {
    const inicio = new Date(`${this.range().start}T00:00:00Z`).getTime();
    const fin = new Date(`${this.range().end}T00:00:00Z`).getTime();
    return Math.max(1, Math.round((fin - inicio) / 86_400_000) + 1);
  }
  /**
   * Saldo de cuentas líquidas (ahorro + efectivo): lo que hay a mano de verdad, sin contar
   * cupo de tarjetas. Usa todos los movimientos, no solo los del periodo filtrado -un saldo
   * es una foto de ahora mismo, no la suma de lo que paso en un rango.
   */
  private disponibleLiquido(): number {
    const movimientos = this.store.data().movements;
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'savings' || a.type === 'cash')
      .reduce((s, a) => s + accountBalance(a, movimientos), 0);
  }
  /** Deuda de tarjetas: solo el lado negativo del saldo -una tarjeta a favor no es deuda. */
  private deudaTarjetas(): number {
    const movimientos = this.store.data().movements;
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .reduce((s, a) => s + Math.max(0, -accountBalance(a, movimientos)), 0);
  }
  private cupoTotalTarjetas(): number {
    return this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .reduce((s, a) => s + (a.limit ?? 0), 0);
  }
  /** Suma de gasto (importe negativo) de los movimientos del periodo que cumplen la condición. */
  private gastoFiltrado(movs: readonly Movement[], cumple: (m: Movement) => boolean): number {
    return movs.filter((m) => m.amount < 0 && cumple(m)).reduce((s, m) => s - m.amount, 0);
  }
  /** Tarjeta de crédito con más movimientos en el periodo -"cuál se usa más", no cuánta deuda tiene. */
  private tarjetaMasUsada(): { name: string; count: number } | null {
    const conteo = new Map<string, number>();
    for (const m of this.movements()) {
      const cuenta = this.store.account(m.accountId);
      if (cuenta?.type === 'credit') conteo.set(cuenta.id, (conteo.get(cuenta.id) ?? 0) + 1);
    }
    let mejor: { id: string; count: number } | null = null;
    for (const [id, count] of conteo) if (!mejor || count > mejor.count) mejor = { id, count };
    return mejor ? { name: this.store.account(mejor.id)?.name ?? this.i18n.t('dashboard.kpi.noCard'), count: mejor.count } : null;
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
    return this.formatMeasure(valor, { measure: formula === 'dailyExpense' ? 'expense' : formula === 'dailyIncome' ? 'income' : formula });
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
  private readonly formulasDeGasto: readonly KpiFormula[] = [
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
  private readonly formulasDeIngreso: readonly KpiFormula[] = [
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

  readonly hasFilters = computed(
    () =>
      this.scale() !== 'month' ||
      this.anchor() !== '2026-08-31' ||
      this.accountId() !== 'all' ||
      this.accountType() !== 'all' ||
      this.globalCategory() !== 'all' ||
      this.localCategory() !== 'all',
  );
  readonly selectedMovement = computed(() => {
    const s = this.store.inspector();
    return s?.type === 'movement' ? this.store.data().movements.find((m) => m.id === s.id) : undefined;
  });
  readonly columns = computed(() => [
    { key: 'date', label: this.i18n.t('dashboard.detail.date') },
    { key: 'description', label: this.i18n.t('dashboard.table.description') },
    { key: 'category', label: this.i18n.t('dashboard.detail.category') },
    { key: 'account', label: this.i18n.t('dashboard.detail.account') },
    { key: 'amount', label: this.i18n.t('dashboard.chart.amountAxis') },
  ]);
  readonly rows = computed(() =>
    this.movements()
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({
        id: m.id,
        date: m.date,
        description: m.description,
        category: m.category,
        account: this.store.account(m.accountId)?.name,
        amount: this.store.money(m.amount),
      })),
  );
  changeAccountType(type: string) {
    this.accountType.set(type);
    if (this.accountId() !== 'all' && !this.accountOptions().some((a) => a.id === this.accountId()))
      this.accountId.set('all');
  }
  promoteCategory() {
    this.globalCategory.set(this.localCategory());
    this.store.log(this.i18n.t('dashboard.log.filterApplied', { value: this.localCategory() }));
  }
  reset() {
    this.scale.set('month');
    this.anchor.set('2026-08-31');
    this.accountId.set('all');
    this.accountType.set('all');
    this.globalCategory.set('all');
    this.localCategory.set('all');
  }
  hide(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => [...x, id]);
  }
  show(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => x.filter((v) => v !== id));
  }
  move(id: string, direction: number) {
    if (!this.caps.allows(P.dashboard.widget.orden.editar)) return;
    this.all.update((items) => {
      const next = [...items],
        index = next.findIndex((item) => item.id === id),
        target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  changeType(id: string, type: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const nextType = type as WidgetType;
        // Al pasar de un tipo fijo a uno genérico sin dimensión/métrica todavía elegida,
        // se necesita un valor por defecto: sin esto el widget se quedaba sin datos que
        // agregar hasta que alguien abriera el selector y tocara algo.
        const necesitaDefaults = this.isGeneric(nextType) && !item.dimension;
        return necesitaDefaults
          ? { ...item, type: nextType, dimension: 'category', measure: item.measure ?? 'expense' }
          : { ...item, type: nextType };
      }),
    );
  }
  changeDimension(id: string, dimension: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, dimension: dimension as Dimension } : item)));
  }
  changeDimension2(id: string, dimension2: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) =>
      items.map((item) => (item.id === id ? { ...item, dimension2: dimension2 as Dimension } : item)),
    );
  }
  changeMeasure(id: string, measure: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, measure: measure as Measure } : item)));
  }
  changeGoal(id: string, field: 'goalMin' | 'goalTarget' | 'goalMax', value: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    const numero = Number(value);
    if (Number.isNaN(numero)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, [field]: numero } : item)));
  }
  createWidget(event: Event) {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const title = this.newWidgetTitle.trim();
    if (!title) return;
    const generic = this.isGeneric(this.newWidgetMetric);
    this.all.update((items) => [
      ...items,
      {
        id: `custom-${Date.now()}`,
        title,
        kicker: this.i18n.t('dashboard.widget.custom.kicker'),
        type: this.newWidgetMetric,
        wide: this.newWidgetWidth === 'wide' && this.newWidgetMetric !== 'indicator',
        ...(generic
          ? {
              dimension: this.newWidgetDimension,
              measure: this.newWidgetMeasure,
              ...(this.needsDimension2(this.newWidgetMetric) ? { dimension2: this.newWidgetDimension2 } : {}),
              ...(this.needsGoal(this.newWidgetMetric)
                ? { goalMin: this.newWidgetGoalMin, goalTarget: this.newWidgetGoalTarget, goalMax: this.newWidgetGoalMax }
                : {}),
            }
          : {}),
      },
    ]);
    this.newWidgetTitle = '';
    this.widgetCreatorOpen.set(false);
    this.store.log(this.i18n.t('dashboard.log.widgetAdded', { title }));
  }
  /**
   * Opciones comunes de eje para las graficas de intervalo del tablero.
   *
   * El eje de valores se rotula en miles o millones: las cifras en pesos colombianos
   * llegan a siete digitos y repetidas en cada marca tapaban la grafica.
   */
  private ejes(palette: ReturnType<ChartThemeService['palette']>, etiquetas: readonly string[]) {
    return {
      grid: { top: 28, right: 18, bottom: 34, left: 62 },
      xAxis: {
        type: 'category' as const,
        data: [...etiquetas],
        boundaryGap: false,
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, hideOverlap: true },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
        axisLabel: { color: palette.muted, formatter: (valor: number) => this.cifraCorta(valor) },
      },
    };
  }

  /** 1.650.000 se lee peor que 1,7 M cuando se repite en cada marca del eje. */
  private cifraCorta(valor: number) {
    const absoluto = Math.abs(valor);
    if (absoluto >= 1_000_000) return `${(valor / 1_000_000).toFixed(absoluto >= 10_000_000 ? 0 : 1)} M`;
    if (absoluto >= 1_000) return `${Math.round(valor / 1_000)} k`;
    return String(valor);
  }

  private degradado(color: string) {
    return {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: this.conAlfa(color, 0.28) },
        { offset: 1, color: this.conAlfa(color, 0) },
      ],
    };
  }

  /** El tema entrega los colores como los escribio su autor: hex, rgb() o color-mix(). */
  private conAlfa(color: string, alfa: number) {
    const limpio = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(limpio)) {
      const n = parseInt(limpio.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
    }
    if (limpio.startsWith('rgb'))
      return limpio.replace(/^rgba?\(([^)]+)\)$/, (_, dentro: string) => {
        const partes = dentro.split(/[,/]/).map((x) => x.trim());
        return `rgba(${partes[0]}, ${partes[1]}, ${partes[2]}, ${alfa})`;
      });
    return `color-mix(in srgb, ${limpio} ${Math.round(alfa * 100)}%, transparent)`;
  }

  /** Ingresos y gastos del periodo, con lupa cuando los intervalos no caben holgados. */
  readonly flujoOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const puntos = this.timeline();
    const serie = (nombre: string, valores: number[], color: string) => ({
      name: nombre,
      type: 'line' as const,
      smooth: 0.24,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 2.4, color },
      itemStyle: { color },
      areaStyle: { color: this.degradado(color) },
      emphasis: { focus: 'series' as const, showSymbol: true },
      data: valores,
    });
    return {
      ...this.ejes(
        palette,
        puntos.map((p) => p.label),
      ),
      legend: {
        data: [this.i18n.t('dashboard.series.income'), this.i18n.t('dashboard.series.expense')],
        top: 0,
        right: 0,
        textStyle: { color: palette.muted },
        icon: 'circle',
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'line' as const, lineStyle: { color: palette.line } },
        valueFormatter: (valor: unknown) => this.store.money(Number(valor)),
      },
      dataZoom:
        puntos.length > 14
          ? [
              { type: 'inside' as const, start: 0, end: 100 },
              {
                type: 'slider' as const,
                height: 16,
                bottom: 4,
                borderColor: palette.line,
                backgroundColor: 'transparent',
                fillerColor: this.conAlfa(palette.accent, 0.14),
                dataBackground: {
                  lineStyle: { color: palette.line },
                  areaStyle: { color: this.conAlfa(palette.accent, 0.1) },
                },
                selectedDataBackground: {
                  lineStyle: { color: palette.accent },
                  areaStyle: { color: this.conAlfa(palette.accent, 0.18) },
                },
                handleStyle: { color: palette.surface, borderColor: palette.accent },
                moveHandleStyle: { color: this.conAlfa(palette.accent, 0.4) },
                textStyle: { color: palette.muted },
              },
            ]
          : undefined,
      series: [
        serie(
          this.i18n.t('dashboard.series.income'),
          puntos.map((p) => p.income),
          palette.accent,
        ),
        serie(
          this.i18n.t('dashboard.series.expense'),
          puntos.map((p) => p.expense),
          palette.danger,
        ),
      ],
    };
  });

  /** Gasto del periodo con su promedio: una linea sola no dice si el dia fue caro. */
  readonly tendenciaOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const puntos = this.timeline();
    const gastos = puntos.map((p) => p.expense);
    const promedio = gastos.length ? gastos.reduce((s, v) => s + v, 0) / gastos.length : 0;
    return {
      ...this.ejes(
        palette,
        puntos.map((p) => p.label),
      ),
      tooltip: { trigger: 'axis' as const, valueFormatter: (valor: unknown) => this.store.money(Number(valor)) },
      series: [
        {
          name: this.i18n.t('dashboard.series.expense'),
          type: 'line' as const,
          smooth: 0.24,
          showSymbol: false,
          lineStyle: { width: 2.4, color: palette.accent },
          itemStyle: { color: palette.accent },
          areaStyle: { color: this.degradado(palette.accent) },
          data: gastos,
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              formatter: this.i18n.t('dashboard.chart.average', { value: this.cifraCorta(promedio) }),
              color: palette.muted,
              position: 'insideEndTop' as const,
            },
            lineStyle: { color: palette.muted, type: 'dashed' as const },
            data: [{ yAxis: promedio }],
          },
        },
      ],
    };
  });

  /** Cada movimiento en su fecha y su importe; el color separa lo que entra de lo que sale. */
  readonly dispersionOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const puntos = this.movements().filter((m) => m.amount !== 0);
    const mayor = Math.max(1, ...puntos.map((m) => Math.abs(m.amount)));
    const serie = (nombre: string, color: string, entra: boolean) => ({
      name: nombre,
      type: 'scatter' as const,
      symbolSize: (valor: number[]) => 8 + (Math.abs(valor[1]) / mayor) * 16,
      itemStyle: { color, opacity: 0.75 },
      data: puntos
        .filter((m) => m.amount > 0 === entra)
        .map((m) => ({ value: [m.date, Math.abs(m.amount)], name: m.description })),
    });
    return {
      grid: { top: 28, right: 18, bottom: 40, left: 62 },
      legend: { top: 0, right: 0, textStyle: { color: palette.muted }, icon: 'circle' },
      xAxis: {
        type: 'time' as const,
        axisLine: { lineStyle: { color: palette.line } },
        axisLabel: { color: palette.muted, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        name: this.i18n.t('dashboard.chart.amountAxis'),
        nameTextStyle: { color: palette.muted },
        splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
        axisLabel: { color: palette.muted, formatter: (valor: number) => this.cifraCorta(valor) },
      },
      tooltip: {
        trigger: 'item' as const,
        formatter: (parametro: { name?: string; value: [string, number] }) =>
          (parametro.name ?? '') +
          '<br/><b>' +
          this.store.money(parametro.value[1]) +
          '</b><br/><small>' +
          parametro.value[0] +
          '</small>',
      },
      series: [
        serie(this.i18n.t('dashboard.series.income'), palette.accent, true),
        serie(this.i18n.t('dashboard.series.expense'), palette.danger, false),
      ],
    };
  });

  /** Reparto del gasto por categoria; pulsar una porcion filtra el tablero por ella. */
  readonly anilloOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const reparto = this.categoryDistribution().slice(0, 6);
    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (parametro: { name: string; value: number; percent: number }) =>
          parametro.name + '<br/><b>' + this.store.money(parametro.value) + '</b> · ' + parametro.percent + '%',
      },
      legend: {
        orient: 'vertical' as const,
        right: 0,
        top: 'middle',
        textStyle: { color: palette.muted, fontSize: 14 },
        itemWidth: 13,
        itemHeight: 13,
        itemGap: 16,
        icon: 'circle',
      },
      series: [
        {
          type: 'pie' as const,
          radius: ['58%', '82%'],
          center: ['34%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 6 },
          label: {
            show: true,
            position: 'center' as const,
            formatter: () =>
              '{valor|' + this.store.money(this.expense()) + '}\n{pie|' + this.i18n.t('dashboard.widget.donut.totalLabel') + '}',
            rich: {
              valor: { color: palette.text, fontSize: 24, fontWeight: 700 },
              pie: { color: palette.muted, fontSize: 13, padding: [8, 0, 0, 0] },
            },
          },
          emphasis: { label: { show: true }, scaleSize: 6 },
          data: reparto.map((categoria) => ({ name: categoria.name, value: categoria.value })),
        },
      ],
    };
  });

  /** Lo que entro y lo que salio en cada intervalo, uno sobre otro. */
  readonly apiladoOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const puntos = this.timeline();
    const barra = (nombre: string, valores: number[], color: string, arriba: boolean) => ({
      name: nombre,
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 26,
      itemStyle: { color, borderRadius: arriba ? ([5, 5, 0, 0] as [number, number, number, number]) : 0 },
      emphasis: { focus: 'series' as const },
      data: valores,
    });
    return {
      ...this.ejes(
        palette,
        puntos.map((p) => p.label),
      ),
      legend: {
        data: [this.i18n.t('dashboard.series.income'), this.i18n.t('dashboard.series.expense')],
        top: 0,
        right: 0,
        textStyle: { color: palette.muted },
        icon: 'circle',
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        valueFormatter: (valor: unknown) => this.store.money(Number(valor)),
      },
      series: [
        barra(
          this.i18n.t('dashboard.series.expense'),
          puntos.map((p) => p.expense),
          palette.danger,
          false,
        ),
        barra(
          this.i18n.t('dashboard.series.income'),
          puntos.map((p) => p.income),
          palette.accent,
          true,
        ),
      ],
    };
  });

  /**
   * Que parte de lo que entro se quedo.
   *
   * Se acota a cero y a cien: un periodo con mas gasto que ingreso daria negativo y la
   * aguja se saldria de la esfera, y el exceso no es informacion que un medidor pueda
   * mostrar. La cifra del centro sigue siendo el balance de verdad.
   */
  readonly tasaDeAhorro = computed(() => {
    const entra = this.income();
    if (entra <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.net() / entra) * 100)));
  });

  /** Tasa de ahorro del periodo, con los tres tramos marcados en la esfera. */
  readonly medidorOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const tasa = this.tasaDeAhorro();
    return {
      series: [
        {
          type: 'gauge' as const,
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          radius: '96%',
          center: ['50%', '64%'],
          progress: { show: false },
          // Los tramos son los de siempre en finanzas personales: por debajo del diez por
          // ciento no se esta guardando, hasta el veinte se va justo, y de ahi arriba el
          // periodo cierra con holgura.
          axisLine: {
            lineStyle: {
              width: 26,
              color: [
                [0.1, this.conAlfa(palette.danger, 0.75)],
                [0.2, this.conAlfa(palette.warn, 0.75)],
                [1, this.conAlfa(palette.accent, 0.75)],
              ],
            },
          },
          pointer: { width: 6, length: '60%', itemStyle: { color: palette.text } },
          anchor: {
            show: true,
            size: 16,
            itemStyle: { color: palette.surface, borderColor: palette.text, borderWidth: 2 },
          },
          axisTick: { distance: -28, length: 5, lineStyle: { color: palette.surface, width: 1 } },
          splitLine: { distance: -28, length: 12, lineStyle: { color: palette.surface, width: 2 } },
          axisLabel: { distance: 34, color: palette.muted, fontSize: 11, formatter: (valor: number) => `${valor}%` },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '38%'],
            color: palette.text,
            fontSize: 30,
            fontWeight: 700,
            formatter: (valor: number) => `${valor}%`,
          },
          title: { offsetCenter: [0, '70%'], color: palette.muted, fontSize: 12 },
          data: [{ value: tasa, name: this.i18n.t('dashboard.widget.gauge.subtitle') }],
        },
      ],
    };
  });

  /** Cuanto dinero se movio cada intervalo, sin distinguir sentido. */
  readonly intensidadOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const puntos = this.timeline();
    const totales = puntos.map((p) => p.income + p.expense);
    return {
      grid: { top: 10, right: 18, bottom: 58, left: 18, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: puntos.map((p) => p.label),
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, hideOverlap: true },
      },
      yAxis: {
        type: 'category' as const,
        data: [this.i18n.t('dashboard.widget.heatmap.axisLabel')],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.muted },
      },
      visualMap: {
        min: 0,
        max: Math.max(1, ...totales),
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        itemHeight: 120,
        textStyle: { color: palette.muted },
        formatter: (valor: number) => this.cifraCorta(valor),
        inRange: { color: [this.conAlfa(palette.accent, 0.12), palette.accent] },
      },
      tooltip: {
        position: 'top' as const,
        formatter: (parametro: { value: [number, number, number] }) =>
          (puntos[parametro.value[0]]?.label ?? '') + '<br/><b>' + this.store.money(parametro.value[2]) + '</b>',
      },
      series: [
        {
          type: 'heatmap' as const,
          data: totales.map((valor, indice) => [indice, 0, valor]),
          itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { borderColor: palette.text } },
        },
      ],
    };
  });

  /** En cuántos rangos de importe cae cada movimiento del periodo, sin distinguir ingreso de gasto. */
  readonly histogramaOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const montos = this.movements()
      .map((m) => Math.abs(m.amount))
      .filter((v) => v > 0);
    if (!montos.length) return { series: [] };
    const max = Math.max(...montos);
    const cubetas = 8;
    const ancho = max / cubetas || 1;
    const conteo = Array.from({ length: cubetas }, () => 0);
    for (const valor of montos) conteo[Math.min(cubetas - 1, Math.floor(valor / ancho))]++;
    const etiquetas = conteo.map((_, i) => `${this.cifraCorta(i * ancho)}–${this.cifraCorta((i + 1) * ancho)}`);
    return {
      ...this.ejes(palette, etiquetas),
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: unknown) =>
          `${v} ${this.i18n.t(Number(v) === 1 ? 'dashboard.unit.movement' : 'dashboard.unit.movements')}`,
      },
      series: [
        {
          type: 'bar' as const,
          barMaxWidth: 34,
          itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] as [number, number, number, number] },
          data: conteo,
        },
      ],
    };
  });

  /** Clave para agrupar (estable, sin formatear) y etiqueta para mostrar. Iguales salvo en fecha. */
  private dimensionKey(m: Movement, dim: Dimension): { key: string; label: string } {
    if (dim === 'date') {
      const d = new Date(`${m.date}T12:00:00Z`);
      const key = this.scale() === 'year' ? m.date.slice(0, 7) : m.date;
      const label =
        this.scale() === 'year'
          ? new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'short', timeZone: 'UTC' }).format(d)
          : new Intl.DateTimeFormat(this.store.preferences().locale, {
              day: '2-digit',
              month: 'short',
              timeZone: 'UTC',
            }).format(d);
      return { key, label };
    }
    const label =
      dim === 'category'
        ? m.category
        : dim === 'account'
          ? (this.store.account(m.accountId)?.name ?? this.i18n.t('dashboard.account.none'))
          : dim === 'kind'
            ? this.kindLabel(m.kind)
            : dim === 'recurring'
              ? this.i18n.t(m.recurring ? 'dashboard.dimension.recurring.fixed' : 'dashboard.dimension.recurring.variable')
              : dim === 'installments'
                ? this.i18n.t(
                    (m.installmentTotal ?? 1) > 1
                      ? 'dashboard.dimension.installments.yes'
                      : 'dashboard.dimension.installments.no',
                  )
                : (m.person ?? this.i18n.t('dashboard.person.none'));
    return { key: label, label };
  }
  private kindLabel(kind: Movement['kind']): string {
    const etiquetas: Record<string, string> = {
      income: this.i18n.t('dashboard.movement.kind.income'),
      expense: this.i18n.t('dashboard.movement.kind.expense'),
      transfer: this.i18n.t('dashboard.movement.kind.transfer'),
      payment: this.i18n.t('dashboard.movement.kind.payment'),
    };
    return etiquetas[kind] ?? kind;
  }
  /**
   * `expense`/`income` se basan en el signo del importe, no en `kind`: un widget puede
   * partir la misma medida por `kind` como serie (dimension2), y si "gasto" filtrara otra
   * vez por `kind === 'expense'` las series de pago/transferencia saldrían siempre en cero
   * -su filtro y el de la medida se pisan-. El signo no tiene ese problema y es la misma
   * idea de fondo: dinero que sale es gasto, dinero que entra es ingreso.
   */
  private measureValue(rows: readonly Movement[], measure: Measure): number {
    switch (measure) {
      case 'amount':
        return sumBy(rows, (m) => m.amount);
      case 'expense':
        return sumBy(
          rows.filter((m) => m.amount < 0),
          (m) => -m.amount,
        );
      case 'income':
        return sumBy(
          rows.filter((m) => m.amount > 0),
          (m) => m.amount,
        );
      case 'count':
        return rows.length;
      case 'average':
        return rows.length ? sumBy(rows, (m) => Math.abs(m.amount)) / rows.length : 0;
    }
  }
  /** El texto de una cifra según su métrica: unidades para cantidad, dinero para el resto. */
  formatMeasure(value: number, widget: Pick<Widget, 'measure'>): string {
    return (widget.measure ?? 'expense') === 'count' ? Math.round(value).toLocaleString() : this.store.money(value);
  }
  /**
   * Agrega los movimientos del periodo por la dimensión del widget.
   *
   * Fecha ordena cronológicamente por la clave (no la etiqueta: "ene" y "ago" ordenan mal
   * alfabéticamente); el resto ordena de mayor a menor para que lo más relevante quede
   * primero en barras, dona, embudo, etc.
   */
  private aggregate(widget: Pick<Widget, 'dimension' | 'measure'>): { key: string; label: string; value: number }[] {
    const dim = widget.dimension ?? 'category';
    const measure = widget.measure ?? 'expense';
    const grupos = new Map<string, { label: string; filas: Movement[] }>();
    for (const m of this.movements()) {
      const { key, label } = this.dimensionKey(m, dim);
      const entrada = grupos.get(key) ?? { label, filas: [] };
      entrada.filas.push(m);
      grupos.set(key, entrada);
    }
    const filas = [...grupos].map(([key, { label, filas }]) => ({ key, label, value: this.measureValue(filas, measure) }));
    return dim === 'date' ? filas.sort((a, b) => a.key.localeCompare(b.key)) : filas.sort((a, b) => b.value - a.value);
  }
  /**
   * Igual que `aggregate` pero cruzando dos dimensiones: una para el eje y otra para la
   * serie (columnas agrupadas/apiladas, mapa de calor). Las categorías del eje ordenan
   * como en `aggregate`; las series ordenan alfabéticamente, que es estable y predecible.
   */
  private aggregate2D(widget: Widget): { categories: string[]; series: { name: string; data: number[] }[] } {
    const dim = widget.dimension ?? 'category';
    const dim2 = widget.dimension2 ?? 'kind';
    const measure = widget.measure ?? 'expense';
    const ordenCategorias: string[] = [];
    const etiquetaCategoria = new Map<string, string>();
    const series = new Set<string>();
    const celdas = new Map<string, Movement[]>();
    for (const m of this.movements()) {
      const c = this.dimensionKey(m, dim);
      const s = this.dimensionKey(m, dim2);
      if (!etiquetaCategoria.has(c.key)) {
        etiquetaCategoria.set(c.key, c.label);
        ordenCategorias.push(c.key);
      }
      series.add(s.label);
      const clave = c.key + ' ' + s.label;
      const filas = celdas.get(clave) ?? [];
      filas.push(m);
      celdas.set(clave, filas);
    }
    const nombresSeries = [...series].sort();
    const totalCategoria = (categoria: string) =>
      nombresSeries.reduce((s, nombre) => s + this.measureValue(celdas.get(categoria + ' ' + nombre) ?? [], measure), 0);
    const categorias =
      dim === 'date'
        ? [...ordenCategorias].sort()
        : [...ordenCategorias].sort((a, b) => totalCategoria(b) - totalCategoria(a));
    return {
      categories: categorias.map((c) => etiquetaCategoria.get(c) ?? c),
      series: nombresSeries.map((nombre) => ({
        name: nombre,
        data: categorias.map((c) => this.measureValue(celdas.get(c + ' ' + nombre) ?? [], measure)),
      })),
    };
  }
  /** Construye la opción de echarts de un widget genérico según su tipo. */
  widgetOption(widget: Widget): ChartOption {
    const palette = this.temaGrafica.palette();
    const valueFormatter = (valor: unknown) => this.formatMeasure(Number(valor), widget);
    switch (widget.type) {
      case 'line':
      case 'area': {
        const agg = this.aggregate(widget);
        return {
          ...this.ejes(
            palette,
            agg.map((a) => a.label),
          ),
          tooltip: { trigger: 'axis' as const, valueFormatter },
          series: [
            {
              type: 'line' as const,
              smooth: 0.24,
              showSymbol: agg.length <= 20,
              lineStyle: { width: 2.4, color: palette.accent },
              itemStyle: { color: palette.accent },
              areaStyle: widget.type === 'area' ? { color: this.degradado(palette.accent) } : undefined,
              data: agg.map((a) => a.value),
            },
          ],
        };
      }
      case 'bar':
      case 'barH': {
        const agg = this.aggregate(widget).slice(0, 12);
        const horizontal = widget.type === 'barH';
        const ejeCategoria = {
          type: 'category' as const,
          data: agg.map((a) => a.label),
          axisLine: { lineStyle: { color: palette.line } },
          axisTick: { show: false },
          axisLabel: { color: palette.muted, hideOverlap: true },
        };
        const ejeValor = {
          type: 'value' as const,
          splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
          axisLabel: { color: palette.muted, formatter: (v: number) => this.cifraCorta(v) },
        };
        return {
          grid: horizontal
            ? { top: 10, right: 24, bottom: 10, left: 110, containLabel: true }
            : { top: 20, right: 18, bottom: 34, left: 62 },
          xAxis: horizontal ? ejeValor : ejeCategoria,
          yAxis: horizontal ? ejeCategoria : ejeValor,
          tooltip: { trigger: 'axis' as const, valueFormatter },
          series: [
            {
              type: 'bar' as const,
              barMaxWidth: 26,
              itemStyle: {
                color: palette.accent,
                borderRadius: (horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]) as [number, number, number, number],
              },
              data: agg.map((a) => a.value),
            },
          ],
        };
      }
      case 'grouped':
      case 'stackedBars':
      case 'stacked100': {
        const { categories, series } = this.aggregate2D(widget);
        const colores = [palette.accent, palette.danger, palette.warn, '#0ea5e9', '#64748b', '#a855f7'];
        const porcentaje = widget.type === 'stacked100';
        const totales = categories.map((_, i) => series.reduce((s, serie) => s + serie.data[i], 0) || 1);
        return {
          ...this.ejes(palette, categories),
          legend: { data: series.map((s) => s.name), top: 0, right: 0, textStyle: { color: palette.muted }, icon: 'circle' },
          tooltip: {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            valueFormatter: porcentaje ? (v: unknown) => `${(Number(v)).toFixed(0)}%` : valueFormatter,
          },
          series: series.map((serie, i) => ({
            name: serie.name,
            type: 'bar' as const,
            stack: widget.type === 'grouped' ? undefined : 'total',
            barMaxWidth: 26,
            itemStyle: { color: colores[i % colores.length] },
            data: porcentaje ? serie.data.map((v, idx) => (v / totales[idx]) * 100) : serie.data,
          })),
        };
      }
      case 'pie': {
        const agg = this.aggregate(widget).slice(0, 8);
        return {
          tooltip: {
            trigger: 'item' as const,
            formatter: (p: { name: string; value: number; percent: number }) =>
              `${p.name}<br/><b>${this.formatMeasure(p.value, widget)}</b> · ${p.percent}%`,
          },
          legend: {
            orient: 'vertical' as const,
            right: 0,
            top: 'middle',
            textStyle: { color: palette.muted, fontSize: 14 },
            itemWidth: 13,
            itemHeight: 13,
            itemGap: 16,
            icon: 'circle',
          },
          series: [
            {
              type: 'pie' as const,
              radius: '72%',
              center: ['38%', '50%'],
              itemStyle: { borderColor: palette.surface, borderWidth: 2 },
              // Sin esto, la etiqueta y la linea guia usan el negro por defecto de echarts:
              // ilegible sobre el fondo oscuro y la "e" del borde que mencionaste era esa
              // linea guia sin color de tema, no el borde entre porciones.
              label: { color: palette.text, fontSize: 13 },
              labelLine: { lineStyle: { color: palette.line } },
              data: agg.map((a) => ({ name: a.label, value: a.value })),
            },
          ],
        };
      }
      case 'treemap': {
        const agg = this.aggregate(widget);
        return {
          tooltip: { formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${this.formatMeasure(p.value, widget)}</b>` },
          series: [
            {
              type: 'treemap' as const,
              left: '0.5%',
              top: '0.5%',
              right: '0.5%',
              bottom: '0.5%',
              data: agg.map((a) => ({ name: a.label, value: a.value })),
              itemStyle: { borderColor: palette.surface, gapWidth: 2 },
              breadcrumb: { show: false },
              label: { color: '#fff', fontSize: 13 },
            },
          ],
        };
      }
      case 'funnel': {
        const agg = this.aggregate(widget).slice(0, 8);
        return {
          tooltip: { formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${this.formatMeasure(p.value, widget)}</b>` },
          series: [
            {
              type: 'funnel' as const,
              left: '10%',
              width: '80%',
              sort: 'descending' as const,
              label: { color: palette.text },
              itemStyle: { color: palette.accent, borderColor: palette.surface, borderWidth: 1 },
              data: agg.map((a) => ({ name: a.label, value: a.value })),
            },
          ],
        };
      }
      case 'waterfall': {
        const agg = this.aggregate(widget);
        let acumulado = 0;
        const base: number[] = [];
        const delta: { value: number; itemStyle: { color: string } }[] = [];
        for (const a of agg) {
          base.push(a.value >= 0 ? acumulado : acumulado + a.value);
          delta.push({ value: Math.abs(a.value), itemStyle: { color: a.value >= 0 ? palette.accent : palette.danger } });
          acumulado += a.value;
        }
        return {
          ...this.ejes(
            palette,
            agg.map((a) => a.label),
          ),
          tooltip: { trigger: 'axis' as const, valueFormatter },
          series: [
            { type: 'bar' as const, stack: 'cascada', itemStyle: { color: 'transparent' }, silent: true, data: base },
            { type: 'bar' as const, stack: 'cascada', barMaxWidth: 26, data: delta },
          ],
        };
      }
      case 'matrix': {
        const { categories, series } = this.aggregate2D(widget);
        const celdas: [number, number, number][] = [];
        series.forEach((s, yi) => s.data.forEach((v, xi) => celdas.push([xi, yi, v])));
        const max = Math.max(1, ...celdas.map((c) => c[2]));
        return {
          grid: { top: 10, right: 18, bottom: 60, left: 130, containLabel: true },
          xAxis: {
            type: 'category' as const,
            data: categories,
            axisLine: { lineStyle: { color: palette.line } },
            axisTick: { show: false },
            axisLabel: { color: palette.muted, hideOverlap: true },
          },
          yAxis: {
            type: 'category' as const,
            data: series.map((s) => s.name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: palette.muted },
          },
          visualMap: {
            min: 0,
            max,
            calculable: true,
            orient: 'horizontal' as const,
            left: 'center',
            bottom: 0,
            textStyle: { color: palette.muted },
            formatter: (v: number) => this.cifraCorta(v),
            inRange: { color: [this.conAlfa(palette.accent, 0.12), palette.accent] },
          },
          tooltip: {
            formatter: (p: { value: [number, number, number] }) =>
              `${categories[p.value[0]]} · ${series[p.value[1]].name}<br/><b>${this.formatMeasure(p.value[2], widget)}</b>`,
          },
          series: [{ type: 'heatmap' as const, data: celdas, itemStyle: { borderColor: palette.surface, borderWidth: 2 } }],
        };
      }
      case 'indicator':
        return this.indicatorOption(widget);
      default:
        return { series: [] };
    }
  }
  /**
   * Umbrales del semáforo: rojo hasta la mitad de la meta, ámbar hasta la meta, verde de
   * ahí en adelante. Relativos a la meta -no a un 30/60 fijo- porque la meta la define
   * quien crea el widget; un 30% fijo no significaria lo mismo para una meta de $500.000
   * que para una de $50.000.000.
   */
  private indicatorZones(min: number, max: number, meta: number): { low: number; mid: number } {
    const fraccionMeta = max > min ? Math.min(1, Math.max(0, (meta - min) / (max - min))) : 0;
    return { low: fraccionMeta * 0.5, mid: fraccionMeta };
  }
  private indicatorScale(widget: Widget): { min: number; max: number; meta: number; valor: number } {
    const valor = this.cardValue(widget);
    const min = widget.goalMin ?? 0;
    const meta = widget.goalTarget ?? 0;
    const max = widget.goalMax && widget.goalMax > min ? widget.goalMax : Math.max(valor, meta, min + 1) * 1.25;
    return { min, max, meta, valor };
  }
  /** Rojo/ámbar/verde según en qué tramo cae el valor actual -para la aguja y la píldora de estado. */
  indicatorStatus(widget: Widget): { label: string; color: string } {
    const palette = this.temaGrafica.palette();
    const { min, max, meta, valor } = this.indicatorScale(widget);
    const { low, mid } = this.indicatorZones(min, max, meta);
    const valorFraccion = max > min ? Math.min(1, Math.max(0, (valor - min) / (max - min))) : 0;
    if (valorFraccion < low) return { label: this.i18n.t('dashboard.indicator.status.critical'), color: palette.danger };
    if (valorFraccion < mid) return { label: this.i18n.t('dashboard.indicator.status.warning'), color: palette.warn };
    return { label: this.i18n.t('dashboard.indicator.status.good'), color: palette.success };
  }
  /**
   * Indicador con meta: valor actual, mínimo, máximo y meta, cada uno con su color -tal
   * como el "Indicador KPI" de Power BI. Tres tramos de fondo (rojo/ámbar/verde) marcan
   * critico/alerta/bueno igual que la referencia; el arco relleno toma el mismo color que
   * el tramo donde cae el valor, y la aguja marca la meta en sí, encima de todo.
   */
  private indicatorOption(widget: Widget): ChartOption {
    const palette = this.temaGrafica.palette();
    const { min, max, meta, valor } = this.indicatorScale(widget);
    const { low, mid } = this.indicatorZones(min, max, meta);
    const estado = this.indicatorStatus(widget);
    const comun = { startAngle: 200, endAngle: -20, min, max, radius: '96%', center: ['50%', '62%'] };
    return {
      series: [
        {
          ...comun,
          type: 'gauge' as const,
          splitNumber: 4,
          progress: { show: true, width: 16, itemStyle: { color: estado.color } },
          axisLine: {
            lineStyle: {
              width: 16,
              color: [
                [low, this.conAlfa(palette.danger, 0.35)],
                [mid, this.conAlfa(palette.warn, 0.35)],
                [1, this.conAlfa(palette.success, 0.35)],
              ],
            },
          },
          pointer: { show: false },
          anchor: { show: false },
          axisTick: { show: false },
          splitLine: { distance: -18, length: 10, lineStyle: { color: palette.surface, width: 2 } },
          axisLabel: { distance: 26, color: palette.muted, fontSize: 10, formatter: (v: number) => this.cifraCorta(v) },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '15%'],
            color: palette.text,
            fontSize: 22,
            fontWeight: 700,
            formatter: () => this.formatMeasure(valor, widget),
          },
          title: { show: true, offsetCenter: [0, '42%'], color: palette.muted, fontSize: 11 },
          data: [
            { value: valor, name: this.i18n.t('dashboard.widget.indicator.metaLabel', { value: this.formatMeasure(meta, widget) }) },
          ],
        },
        {
          ...comun,
          type: 'gauge' as const,
          progress: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: true, length: '72%', width: 4, itemStyle: { color: palette.text } },
          anchor: { show: true, size: 8, itemStyle: { color: palette.text, borderWidth: 0 } },
          detail: { show: false },
          data: [{ value: meta }],
        },
      ],
    };
  }
  /** Posición del valor actual en la escala 0-100%, para el puntero de la barra de colores. */
  colorScalePercent(widget: Widget): number {
    const { min, max, valor } = this.indicatorScale(widget);
    return max > min ? Math.min(100, Math.max(0, ((valor - min) / (max - min)) * 100)) : 0;
  }
  /** Igual que `colorScalePercent` pero para la meta, así el rótulo cae en el punto correcto de la barra. */
  colorScaleMetaPercent(widget: Widget): number {
    const { min, max, meta } = this.indicatorScale(widget);
    return max > min ? Math.min(100, Math.max(0, ((meta - min) / (max - min)) * 100)) : 0;
  }
  /**
   * Filas de `aggregate` con un porcentaje relativo al mayor valor del grupo -para dibujar
   * cada una como una barra de progreso- y un tono según ese porcentaje, igual que el
   * "Indicador de Barra de Estado" de la referencia: verde arriba de 66%, ámbar entre 33 y
   * 66, rojo debajo.
   */
  statusBarsRows(widget: Widget): { label: string; value: number; percent: number; tone: 'success' | 'warn' | 'danger' }[] {
    const filas = this.aggregate(widget).slice(0, 6);
    const max = Math.max(1, ...filas.map((f) => Math.abs(f.value)));
    return filas.map((f) => {
      const percent = Math.min(100, Math.max(0, (Math.abs(f.value) / max) * 100));
      const tone = percent >= 66 ? 'success' : percent >= 33 ? 'warn' : 'danger';
      return { label: f.label, value: f.value, percent, tone };
    });
  }
  /** Total agregado de un widget "tarjeta": toda la dimensión colapsada en un solo número. */
  cardValue(widget: Widget): number {
    return this.measureValue(this.movements(), widget.measure ?? 'expense');
  }
  measureLabel(widget: Widget): string {
    return this.measureOptions().find((o) => o.value === (widget.measure ?? 'expense'))?.label ?? '';
  }
  /** Filas {etiqueta, valor} para un widget "tabla", ya formateadas para `demo-table`. */
  tableRows(widget: Widget): Record<string, string>[] {
    return this.aggregate(widget).map((a) => ({ label: a.label, value: this.formatMeasure(a.value, widget) }));
  }
  readonly tableColumns = computed(() => [
    { key: 'label', label: this.i18n.t('dashboard.table.group') },
    { key: 'value', label: this.i18n.t('dashboard.table.value') },
  ]);
  shiftPeriod(direction: number) {
    const date = new Date(`${this.anchor()}T12:00:00`);
    if (this.scale() === 'year') date.setFullYear(date.getFullYear() + direction);
    else if (this.scale() === 'month') date.setMonth(date.getMonth() + direction);
    else date.setDate(date.getDate() + direction * (this.scale() === 'week' ? 7 : 1));
    this.anchor.set(this.iso(date));
  }
  inspect(row: Record<string, unknown>) {
    if (!this.caps.allows(P.dashboard.detalle.ver)) return;
    this.store.inspect('movement', String(row['id']));
  }
  typeLabel(type: string) {
    const etiquetas: Record<string, string> = {
      credit: this.i18n.t('dashboard.accountType.credit'),
      savings: this.i18n.t('dashboard.accountType.savings'),
      cash: this.i18n.t('dashboard.accountType.cash'),
    };
    return (
      etiquetas[type] ?? type
    );
  }
  private iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
