import { DashboardPeriodo } from './periodo/dashboard-periodo';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '@core/api';
import { parseMoney, sumBy } from '@core/utils';
import { P } from '@core/session';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import { IconComponent, IconName } from '@ui/icon';
import { DataTableComponent, FinTableCellDirective } from '@ui/data-table';
import { KpiComponent } from '@ui/kpi';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { ChartComponent } from '@ui/chart';
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { CategoryBadgeComponent } from '@ui/category-badge';
import { CategoryListComponent } from './widgets/category-list/category-list';
import { AccountListComponent } from './widgets/account-list/account-list';
import { ColorScaleComponent } from './widgets/color-scale/color-scale';
import { StatusBarsComponent } from './widgets/status-bars/status-bars';
import { WidgetControlsComponent } from './widgets/widget-controls/widget-controls';
import { WidgetCardComponent } from './widgets/widget-card/widget-card';
import { FilterPanelComponent } from './filters/filter-panel/filter-panel';
import { CUSTOM_KPI_PREFIX, FIXED_KPI_PREFIX, KpiStripComponent } from './kpis/kpi-strip/kpi-strip';
import { DashboardLayoutService, WidgetGuardado } from '@shared/tablero/dashboard-layout.service';
import { SelectorDeTablerosComponent } from './tableros/selector-de-tableros';
import { FlowDefault, WIDGET_MIN_COLS } from '@shared/tablero/dashboard-layout';
import { FlowItemComponent } from './layout/flow-item/flow-item';

import {
  WidgetType,
  Dimension,
  Measure,
  Seleccion,
  Widget,
  GENERIC_TYPES,
  TWO_DIMENSION_TYPES,
} from '@shared/tablero/dashboard.model';
import { DashboardKpis } from './dashboard-kpis';
import type { Movement } from '@core/state';
import { crearHistoriaDeFlujo, crearMovimientosDelPeriodo } from '@shared/historia';
import { KpiRanges, KpiStatus, estadoDe } from '@shared/tablero/kpi-ranges';

type KpiStatusValue = KpiStatus | null;
import { buildWidgetCatalog } from './dashboard-widget-catalog';
import {
  ConfiguradorVisualComponent,
  GaleriaVisualComponent,
  OpcionesDeGraficas,
  TIPOS_DEL_MOTOR,
  definicionDe,
} from '@shared/graficas';
import type { ConfiguracionVisual } from '@shared/graficas';

const KPI_HEIGHT = 120;

const CAMPOS_EDITABLES = [
  'type',
  'wide',
  'dimension',
  'dimension2',
  'measure',
  'variant',
  'granularity',
  'limit',
  'goalMin',
  'goalTarget',
  'goalMax',
] as const;

function fusionarWidgets(catalogo: Widget[], guardados: readonly WidgetGuardado[]): Widget[] {
  const porId = new Map(guardados.map((guardado) => [guardado.id, guardado]));
  const base = catalogo.map((widget) => {
    const cambios = porId.get(widget.id);
    return cambios ? ({ ...widget, ...cambios, title: widget.title, kicker: widget.kicker } as Widget) : widget;
  });
  const propios = guardados
    .filter((guardado) => guardado.custom && typeof guardado.title === 'string' && typeof guardado['type'] === 'string')
    .map((guardado) => {
      const { custom, ...widget } = guardado;
      void custom;
      return widget as unknown as Widget;
    });
  return [...base, ...propios];
}

@Component({
  providers: [DashboardPeriodo],
  imports: [
    SelectorDeTablerosComponent,
    HlmButton,
    HlmInput,
    FormsModule,
    RouterLink,
    ChartComponent,
    KpiComponent,
    DataTableComponent,
    FinTableCellDirective,
    CategoryBadgeComponent,
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
    ConfiguradorVisualComponent,
    GaleriaVisualComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class DashboardComponent extends DashboardKpis {
  readonly periodo = inject(DashboardPeriodo);
  readonly scale = this.periodo.scale;
  readonly anchor = this.periodo.anchor;
  readonly range = this.periodo.range;
  readonly historiaEtiqueta = this.periodo.historiaEtiqueta;

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
    const heights: Partial<Record<WidgetType, number>> = { table: 520, card: 190, gauge: 340, heatmap: 300 };
    return { id: widget.id, cols: full ? 12 : 6, height: heights[widget.type] ?? 360 };
  }

  /**
   * Personalizar agrupa cuatro acciones distintas: reordenar, cambiar de tipo, ocultar
   * y crear. El botón aparece si alguna está concedida, y dentro cada control comprueba
   * la suya. Así se puede dar «solo reorganizar» sin dar «cambiar de visualización».
   */
  readonly puedePersonalizar = computed(
    () =>
      !this.layout.soloLectura() &&
      (this.caps.allows(P.dashboard.widget.orden.editar) ||
        this.caps.allows(P.dashboard.widget.tipo.editar) ||
        this.caps.allows(P.dashboard.widget.deshabilitar) ||
        this.caps.allows(P.dashboard.widget.crear)),
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
      status: KpiStatusValue;
      caption: string;
      ranges: KpiRanges | null;
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
      status: KpiStatusValue;
      caption: string;
      ranges: KpiRanges | null;
    }[] = [];
    const fijo = (key: string, formula: 'amount' | 'income' | 'expense' | 'count', valor: number) => {
      const serie = this.kpiSeriesFor(formula);
      return {
        series: serie,
        delta: this.variacion(serie),
        status: estadoDe(valor, this.rangosDe(FIXED_KPI_PREFIX + key, formula)),
        ranges: this.rangosDe(FIXED_KPI_PREFIX + key, formula),
        caption: serie.length > 1 ? this.historiaEtiqueta() : '',
      };
    };
    if (this.caps.allows(P.dashboard.kpi.balance)) {
      items.push({
        key: 'balance',
        label: this.i18n.t('dashboard.kpi.balance.label'),
        icon: 'wallet',
        tone: 'accent',
        value: this.store.money(this.net()),
        hint: this.periodo.periodLabel(),
        ...fijo('balance', 'amount', this.net()),
        subirEsBueno: true,
      });
    }
    if (this.caps.allows(P.dashboard.kpi.ingresos)) {
      items.push({
        key: 'ingresos',
        label: this.i18n.t('dashboard.kpi.income.label'),
        icon: 'cash',
        tone: 'success',
        value: this.store.money(this.income()),
        hint: this.i18n.t('dashboard.kpi.defaultHint'),
        ...fijo('ingresos', 'income', this.income()),
        subirEsBueno: true,
      });
    }
    if (this.caps.allows(P.dashboard.kpi.gastos)) {
      items.push({
        key: 'gastos',
        label: this.i18n.t('dashboard.kpi.expense.label'),
        icon: 'cart',
        tone: 'danger',
        value: this.store.money(this.expense()),
        hint: this.i18n.t('dashboard.kpi.defaultHint'),
        ...fijo('gastos', 'expense', this.expense()),
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
        ...fijo('recuento', 'count', this.movements().length),
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
    sincronizarConLaUrl('cuenta', this.accountId, 'all'),
    sincronizarConLaUrl('tipo', this.accountType, 'all', (v) => ['all', 'credit', 'savings', 'cash'].includes(v)),
    sincronizarConLaUrl('categoria', this.globalCategory, 'all'),
  ];
  readonly hiddenIds = signal<string[]>([]);
  readonly widgetCreatorOpen = signal(false);
  newWidgetTitle = '';
  private readonly opcionesDeGraficas = inject(OpcionesDeGraficas);
  readonly nuevoVisual = signal<ConfiguracionVisual>({ tipo: 'bar', dimension: 'category', measure: 'expense' });
  readonly otroTipo = signal<WidgetType | ''>('');
  get newWidgetMetric(): WidgetType {
    return this.otroTipo() || this.nuevoVisual().tipo;
  }
  readonly vistaPrevia = computed(() =>
    this.otroTipo()
      ? null
      : this.widgetOption({
          id: 'vista-previa',
          title: '',
          kicker: '',
          type: this.nuevoVisual().tipo,
          wide: true,
          ...this.sinTipo(this.nuevoVisual()),
        }),
  );
  elegirTipoDelMotor(tipo: string): void {
    const definicion = definicionDe(tipo);
    if (!definicion) return;
    this.otroTipo.set('');
    this.newWidgetWidth = definicion.ancha ? 'wide' : 'half';
    this.nuevoVisual.update((actual) => ({
      ...actual,
      tipo: definicion.tipo,
      variant: undefined,
      dimension: definicion.sugerida.dimension,
      dimension2: definicion.sugerida.dimension2,
      measure: definicion.sugerida.measure ?? 'expense',
    }));
  }
  private sinTipo(config: ConfiguracionVisual): Omit<ConfiguracionVisual, 'tipo'> {
    const { tipo, ...resto } = config;
    void tipo;
    return resto;
  }
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
  readonly otherWidgetTypeOptions = computed<readonly UiOption[]>(() =>
    (
      [
        'indicator',
        'colorScale',
        'statusBars',
        'table',
        'flow',
        'trend',
        'categories',
        'accounts',
        'scatter',
        'donut',
        'stacked',
        'heatmap',
        'gauge',
        'histogram',
      ] as const
    ).map((value) => ({ value, label: this.i18n.t(`dashboard.widgetType.${value}`) })),
  );
  readonly widgetTypeOptions = computed<readonly UiOption[]>(() => [
    ...this.opcionesDeGraficas.tipos(),
    ...this.otherWidgetTypeOptions().map((opcion) => ({ ...opcion, description: this.i18n.t('charts.group.others') })),
  ]);

  readonly dimensionOptions = this.opcionesDeGraficas.dimensiones;

  readonly measureOptions = this.opcionesDeGraficas.medidas;

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
  esDelMotor(type: string): boolean {
    return TIPOS_DEL_MOTOR.has(type);
  }
  variantOptions(type: string): readonly UiOption[] {
    return this.opcionesDeGraficas.variantes(type);
  }
  readonly granularityOptions = this.opcionesDeGraficas.granularidades;
  needsGoal(type: WidgetType): boolean {
    return type === 'indicator' || type === 'colorScale';
  }
  readonly all = signal<Widget[]>(buildWidgetCatalog(this.i18n));
  private readonly restaurarWidgets = effect(() => {
    const guardados = this.layout.widgetConfigs();
    untracked(() => this.all.set(fusionarWidgets(buildWidgetCatalog(this.i18n), guardados ?? [])));
  });
  private guardarWidgets(): void {
    const catalogo = new Map(buildWidgetCatalog(this.i18n).map((widget) => [widget.id, widget]));
    const configs = this.all().flatMap((widget): WidgetGuardado[] => {
      const original = catalogo.get(widget.id);
      if (!original) return [{ ...widget, custom: true }];
      const cambios = Object.fromEntries(
        CAMPOS_EDITABLES.filter((campo) => widget[campo] !== original[campo]).map((campo) => [campo, widget[campo]]),
      );
      return Object.keys(cambios).length ? [{ id: widget.id, ...cambios }] : [];
    });
    this.layout.saveWidgetConfigs(configs);
  }
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
  readonly seleccion = signal<Seleccion | null>(null);
  private cumpleSeleccion(m: Movement, conFecha: boolean): boolean {
    const seleccion = this.seleccion();
    if (!seleccion) return true;
    if (seleccion.tipo === 'importe') {
      const valor = Math.abs(m.amount);
      return valor >= seleccion.min && valor <= seleccion.max;
    }
    if (seleccion.dimension === 'date' && !conFecha) return true;
    return this.dimensionKey(m, seleccion.dimension).label === seleccion.label;
  }
  private seleccionSoloDeFecha(): boolean {
    const seleccion = this.seleccion();
    return !seleccion || (seleccion.tipo === 'dimension' && seleccion.dimension === 'date');
  }
  private coincideConFiltros(m: Movement): boolean {
    const cuenta = this.store.account(m.accountId);
    return (
      (this.accountId() === 'all' || m.accountId === this.accountId()) &&
      (this.accountType() === 'all' || cuenta?.type === this.accountType()) &&
      (this.globalCategory() === 'all' || m.category === this.globalCategory()) &&
      this.cumpleSeleccion(m, false)
    );
  }
  readonly historial = crearHistoriaDeFlujo(this.periodo.rangosHistoricos, {
    incluir: (m) => this.coincideConFiltros(m),
    usarServidor: () =>
      this.accountId() === 'all' &&
      this.accountType() === 'all' &&
      this.globalCategory() === 'all' &&
      this.seleccionSoloDeFecha(),
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
    if (this.nadaQueMostrar()) return;
    void firstValueFrom(this.api.dashboard(rango.start, rango.end))
      .then((valor) => this.remote.set(valor))
      .catch(() => this.remote.set(null));
  });

  private readonly delPeriodo = crearMovimientosDelPeriodo(computed(() => this.range()));
  readonly cargandoPeriodo = this.delPeriodo.cargando;
  readonly base = computed(() =>
    this.delPeriodo.movimientos().filter((m) => {
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
    this.base().filter(
      (m) => (this.globalCategory() === 'all' || m.category === this.globalCategory()) && this.cumpleSeleccion(m, true),
    ),
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
    const total = sumBy([...totals.values()], (value) => value),
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
        amount: -sumBy(
          this.movements().filter(
            (m) => m.accountId === a.id && m.kind === 'expense' && !m.movementSubtype && m.amount < 0,
          ),
          (m) => m.amount,
        ),
      }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  );

  /**
   * Variacion del ultimo intervalo frente al anterior, en tanto por ciento.
   *
   * Con menos de dos intervalos, o si el anterior fue cero, no hay comparacion honesta
   * que hacer y la tarjeta no ensena ninguna: un «+100 %» sobre cero no informa de nada.
   */
  readonly hasFilters = computed(
    () =>
      this.scale() !== 'month' ||
      this.anchor() !== this.periodo.anclaPorDefecto ||
      this.accountId() !== 'all' ||
      this.accountType() !== 'all' ||
      this.globalCategory() !== 'all' ||
      this.localCategory() !== 'all' ||
      this.seleccion() !== null,
  );
  readonly selectedMovement = computed(() => {
    const s = this.store.inspector();
    return s?.type === 'movement' ? this.store.data().movements.find((m) => m.id === s.id) : undefined;
  });
  readonly columns = computed(() => [
    { key: 'date', label: this.i18n.t('dashboard.detail.date') },
    { key: 'description', label: this.i18n.t('dashboard.table.description') },
    { key: 'category', label: this.i18n.t('dashboard.detail.category'), facet: true },
    { key: 'account', label: this.i18n.t('dashboard.detail.account'), facet: true },
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
  alternarCategoria(nombre: string) {
    this.globalCategory.set(this.globalCategory() === nombre ? 'all' : nombre);
  }
  alternarCuenta(id: string) {
    this.accountId.set(this.accountId() === id ? 'all' : id);
  }
  alPulsarPunto(widget: Widget, nombre: string) {
    this.alPulsarDimension(widget.dimension ?? 'category', nombre);
  }
  alPulsarDimension(dimension: Dimension, nombre: string) {
    if (dimension === 'category') return this.alternarCategoria(nombre);
    if (dimension === 'account') {
      const cuenta = this.store.data().accounts.find((a) => a.name === nombre);
      if (cuenta) this.alternarCuenta(cuenta.id);
      return;
    }
    const actual = this.seleccion();
    const misma = actual?.tipo === 'dimension' && actual.dimension === dimension && actual.label === nombre;
    this.seleccion.set(misma ? null : { tipo: 'dimension', dimension, label: nombre });
  }
  alPulsarHistograma(nombre: string) {
    if (this.seleccion()?.tipo === 'importe') return this.seleccion.set(null);
    const { etiquetas, ancho, cubetas } = this.cubetasDelHistograma();
    const indice = etiquetas.indexOf(nombre);
    if (indice < 0) return;
    const max = indice === cubetas - 1 ? Number.POSITIVE_INFINITY : (indice + 1) * ancho;
    this.seleccion.set({ tipo: 'importe', min: indice * ancho, max, label: nombre });
  }
  alPulsarMovimiento(nombre: string) {
    const movimiento = this.movements().find((m) => m.id === nombre);
    if (movimiento) this.inspect({ id: movimiento.id });
  }
  readonly seleccionEtiqueta = computed(() => {
    const seleccion = this.seleccion();
    if (!seleccion) return '';
    if (seleccion.tipo === 'importe') return `${this.i18n.t('dashboard.selection.amount')}: ${seleccion.label}`;
    return `${this.i18n.t(`dashboard.dimension.${seleccion.dimension}`)}: ${seleccion.label}`;
  });
  promoteCategory() {
    this.globalCategory.set(this.localCategory());
    this.store.log(this.i18n.t('dashboard.log.filterApplied', { value: this.localCategory() }));
  }
  reset() {
    this.scale.set('month');
    this.anchor.set(this.periodo.anclaPorDefecto);
    this.accountId.set('all');
    this.accountType.set('all');
    this.globalCategory.set('all');
    this.localCategory.set('all');
    this.seleccion.set(null);
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
    this.guardarWidgets();
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
    this.guardarWidgets();
  }
  changeDimension(id: string, dimension: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) =>
      items.map((item) => (item.id === id ? { ...item, dimension: dimension as Dimension } : item)),
    );
    this.guardarWidgets();
  }
  changeDimension2(id: string, dimension2: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) =>
      items.map((item) => (item.id === id ? { ...item, dimension2: dimension2 as Dimension } : item)),
    );
    this.guardarWidgets();
  }
  changeMeasure(id: string, measure: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, measure: measure as Measure } : item)));
    this.guardarWidgets();
  }
  changeWidgetField(id: string, field: 'variant' | 'granularity', value: string | undefined) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    this.guardarWidgets();
  }
  changeGoal(id: string, field: 'goalMin' | 'goalTarget' | 'goalMax', value: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    const numero = Number(value);
    if (Number.isNaN(numero)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, [field]: numero } : item)));
    this.guardarWidgets();
  }
  createWidget(event: Event) {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const title = this.newWidgetTitle.trim();
    if (!title) return;
    const generic = this.isGeneric(this.newWidgetMetric);
    const delMotor = this.esDelMotor(this.newWidgetMetric);
    const visual = this.nuevoVisual();
    this.all.update((items) => [
      ...items,
      {
        id: `custom-${Date.now()}`,
        title,
        kicker: this.i18n.t('dashboard.widget.custom.kicker'),
        type: this.newWidgetMetric,
        wide: this.newWidgetWidth === 'wide' && this.newWidgetMetric !== 'indicator',
        ...(delMotor
          ? this.sinTipo(visual)
          : generic
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
    this.guardarWidgets();
    this.newWidgetTitle = '';
    this.otroTipo.set('');
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
