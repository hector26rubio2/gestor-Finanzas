import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '../../core/api/api-client';
import {} from '../../core/state/demo-data';
import {} from '../../core/i18n';
import { parseMoney, sumBy } from '../../core/utils/money';
import { P } from '../../core/session/permissions';
import { sincronizarConLaUrl } from '../../core/state/url-state';
import {} from '../../core/state/store';
import { IconComponent, IconName } from '../../ui/icon/icon';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { OverlayComponent } from '../../ui/overlay/overlay';
import { UiOption, UiSelectComponent } from '../../ui/select/select';
import { ChartComponent } from '../../ui/chart/chart';
import {} from '../../ui/chart/chart-theme';
import { NumericInputDirective } from '../../ui/numeric-input/numeric-input.directive';
import { FieldComponent } from '../../ui/field/field';
import { CategoryListComponent } from './widgets/category-list/category-list';
import { AccountListComponent } from './widgets/account-list/account-list';
import { ColorScaleComponent } from './widgets/color-scale/color-scale';
import { StatusBarsComponent } from './widgets/status-bars/status-bars';
import { WidgetControlsComponent } from './widgets/widget-controls/widget-controls';
import { WidgetCardComponent } from './widgets/widget-card/widget-card';
import { FilterPanelComponent } from './filters/filter-panel/filter-panel';
import { CUSTOM_KPI_PREFIX, FIXED_KPI_PREFIX, KpiStripComponent } from './kpis/kpi-strip/kpi-strip';
import { DashboardLayoutService } from './layout/dashboard-layout.service';
import { FlowDefault, WIDGET_MIN_COLS } from './layout/dashboard-layout';
import { FlowItemComponent } from './layout/flow-item/flow-item';

import { Scale, WidgetType, Dimension, Measure, Widget, GENERIC_TYPES, TWO_DIMENSION_TYPES } from './dashboard.model';
import { DashboardKpis } from './dashboard-kpis';
import { buildWidgetCatalog } from './dashboard-widget-catalog';
import {} from './dashboard-chart-style';

const KPI_HEIGHT = 120;

@Component({
  imports: [
    HlmButton,
    HlmInput,
    FormsModule,
    RouterLink,
    ChartComponent,
    KpiComponent,
    DataTableComponent,
    OverlayComponent,
    IconComponent,
    UiSelectComponent,
    CategoryListComponent,
    AccountListComponent,
    ColorScaleComponent,
    StatusBarsComponent,
    FieldComponent,
    NumericInputDirective,
    WidgetControlsComponent,
    WidgetCardComponent,
    FilterPanelComponent,
    KpiStripComponent,
    CdkDropList,
    FlowItemComponent,
  ],
  providers: [DashboardLayoutService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class DashboardComponent extends DashboardKpis {
  readonly P = P;
  private readonly api = inject(FinanceApiClient);
  readonly customizing = signal(false);
  readonly layout = inject(DashboardLayoutService);
  readonly widgetMinCols = WIDGET_MIN_COLS;

  readonly kpisPropios = computed(() => (this.caps.allows(P.dashboard.widget.propios) ? this.customKpiItems() : []));

  private readonly widgetsById = computed(() => new Map(this.widgets().map((widget) => [widget.id, widget])));

  private readonly sincronizarDiseno = effect(() => {
    this.layout.widgetDefaults.set(this.widgets().map((widget) => this.disenoPorDefecto(widget)));
    this.layout.kpiDefaults.set([
      ...this.fixedKpiItems().map((kpi) => ({ id: FIXED_KPI_PREFIX + kpi.key, cols: 3, height: KPI_HEIGHT })),
      ...this.kpisPropios().map((kpi) => ({ id: CUSTOM_KPI_PREFIX + kpi.id, cols: 3, height: KPI_HEIGHT })),
    ]);
  });

  widgetById(id: string): Widget | undefined {
    return this.widgetsById().get(id);
  }

  private disenoPorDefecto(widget: Widget): FlowDefault {
    const full = (widget.wide || widget.type === 'table') && widget.type !== 'indicator';
    const heights: Partial<Record<WidgetType, number>> = { table: 520, card: 140, gauge: 340, heatmap: 300 };
    return { id: widget.id, cols: full ? 12 : 6, height: heights[widget.type] ?? 360 };
  }

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
  /** Los cuatro KPI fijos, ya filtrados por permiso: la franja solo itera lo concedido. */
  readonly fixedKpiItems = computed<
    readonly {
      key: string;
      label: string;
      icon: IconName;
      tone: 'accent' | 'success' | 'danger';
      value: string;
      hint: string;
      series: readonly number[];
      delta: number | null;
      subirEsBueno: boolean;
    }[]
  >(() => {
    const items: {
      key: string;
      label: string;
      icon: IconName;
      tone: 'accent' | 'success' | 'danger';
      value: string;
      hint: string;
      series: readonly number[];
      delta: number | null;
      subirEsBueno: boolean;
    }[] = [];
    if (this.caps.allows(P.dashboard.kpi.balance)) {
      items.push({
        key: 'balance',
        label: this.i18n.t('dashboard.kpi.balance.label'),
        icon: 'trendUp',
        tone: 'accent',
        value: this.store.money(this.net()),
        hint: this.periodLabel(),
        series: this.serieNeta(),
        delta: this.variacion(this.serieNeta()),
        subirEsBueno: true,
      });
    }
    if (this.caps.allows(P.dashboard.kpi.ingresos)) {
      items.push({
        key: 'ingresos',
        label: this.i18n.t('dashboard.kpi.income.label'),
        icon: 'trendUp',
        tone: 'success',
        value: this.store.money(this.income()),
        hint: this.i18n.t('dashboard.kpi.defaultHint'),
        series: this.serieIngresos(),
        delta: this.variacion(this.serieIngresos()),
        subirEsBueno: true,
      });
    }
    if (this.caps.allows(P.dashboard.kpi.gastos)) {
      items.push({
        key: 'gastos',
        label: this.i18n.t('dashboard.kpi.expense.label'),
        icon: 'trendDown',
        tone: 'danger',
        value: this.store.money(this.expense()),
        hint: this.i18n.t('dashboard.kpi.defaultHint'),
        series: this.serieGastos(),
        delta: this.variacion(this.serieGastos()),
        subirEsBueno: false,
      });
    }
    if (this.caps.allows(P.dashboard.kpi.recuento)) {
      items.push({
        key: 'recuento',
        label: this.i18n.t('dashboard.kpi.count.label'),
        icon: 'movements',
        tone: 'accent',
        value: this.movements().length.toLocaleString(),
        hint: this.i18n.t('dashboard.kpi.count.hint'),
        series: [],
        delta: null,
        subirEsBueno: true,
      });
    }
    return items;
  });
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
  private readonly anclaPorDefecto = this.store.runtime.mode === 'demo' ? '2026-08-31' : this.iso(new Date());
  readonly anchor = signal(this.anclaPorDefecto);
  /**
   * Saltar de año a golpe de "‹"/"›" es razonable entre meses vecinos, pero no para ir de
   * 2026 a 1999: son mas de trescientos clics. El selector deja escribir el destino
   * directamente, sin ser el `<input type=date>` del sistema -que no encaja con el resto
   * de controles de la app-, con un `select` como todos los otros filtros.
   */
  readonly periodPickerOpen = signal(false);
  readonly anchorYear = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getFullYear()));
  readonly anchorMonth = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getMonth()));
  readonly anchorDay = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getDate()));
  /** Días del mes/año que muestra el selector: 28-31 según el mes, sin inventar un 31 de febrero. */
  /** Días que tiene el mes del ancla; también el máximo válido para el selector de Día. */
  readonly daysInAnchorMonth = computed(() =>
    new Date(Number(this.anchorYear()), Number(this.anchorMonth()) + 1, 0).getDate(),
  );
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
    sincronizarConLaUrl('fecha', this.anchor, this.anclaPorDefecto, (v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
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
  readonly all = signal<Widget[]>(buildWidgetCatalog(this.i18n));
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
          .filter((m) => m.kind === 'expense' && !m.movementSubtype)
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
      this.movements().filter((m) => m.kind === 'income' && !m.movementSubtype),
      (m) => Math.max(0, m.amount),
    );
  });
  readonly expense = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.expense);
    return sumBy(
      this.movements().filter((m) => m.kind === 'expense' && !m.movementSubtype),
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
          income: m.kind === 'income' && !m.movementSubtype && m.amount > 0 ? m.amount : 0,
          expense: m.kind === 'expense' && !m.movementSubtype && m.amount < 0 ? -m.amount : 0,
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
        !m.movementSubtype &&
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
        typeLabel: this.typeLabel(a.type),
        amount: -this.movements()
          .filter((m) => m.accountId === a.id && m.kind === 'expense' && !m.movementSubtype && m.amount < 0)
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
    this.all.update((items) =>
      items.map((item) => (item.id === id ? { ...item, dimension: dimension as Dimension } : item)),
    );
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
                ? {
                    goalMin: this.newWidgetGoalMin,
                    goalTarget: this.newWidgetGoalTarget,
                    goalMax: this.newWidgetGoalMax,
                  }
                : {}),
            }
          : {}),
      },
    ]);
    this.newWidgetTitle = '';
    this.widgetCreatorOpen.set(false);
    this.store.log(this.i18n.t('dashboard.log.widgetAdded', { title }));
  }
  /** Filas {etiqueta, valor} para un widget "tabla", ya formateadas para `table`. */
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
    return etiquetas[type] ?? type;
  }
}
