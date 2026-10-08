import { DashboardPeriodo } from './periodo/dashboard-periodo';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { P } from '@core/session';
import { IconComponent } from '@ui/icon';
import { DataTableComponent, FinTableCellDirective } from '@ui/data-table';
import { KpiComponent } from '@ui/kpi';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { ChartComponent } from '@ui/chart';
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
import { DashboardLayoutService } from '@shared/tablero/dashboard-layout.service';
import { SelectorDeTablerosComponent } from './tableros/selector-de-tableros';
import { FlowDefault, WIDGET_MIN_COLS } from '@shared/tablero/dashboard-layout';
import { FlowItemComponent } from './layout/flow-item/flow-item';

import { WidgetType, Dimension, Widget, TWO_DIMENSION_TYPES } from '@shared/tablero/dashboard.model';
import { DashboardKpis } from './dashboard-kpis';
import { DatosDelTablero } from './dashboard-datos';
import { estadoDe } from '@shared/tablero/kpi-ranges';
import { construirKpisFijos } from './kpis/kpis-fijos';
import { EdicionDeWidgets, esGenerico } from './widgets/edicion-de-widgets';
import { OpcionesDeGraficas, TIPOS_DEL_MOTOR } from '@shared/graficas';
import { CreadorDeWidgetComponent } from './widgets/creador-de-widget/creador-de-widget';

const KPI_HEIGHT = 120;

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
    WidgetControlsComponent,
    WidgetCardComponent,
    FilterPanelComponent,
    KpiStripComponent,
    CdkDropList,
    FlowItemComponent,
    CreadorDeWidgetComponent,
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

  readonly puedePersonalizar = computed(
    () =>
      !this.layout.soloLectura() &&
      (this.caps.allows(P.dashboard.widget.orden.editar) ||
        this.caps.allows(P.dashboard.widget.tipo.editar) ||
        this.caps.allows(P.dashboard.widget.deshabilitar) ||
        this.caps.allows(P.dashboard.widget.crear)),
  );

  readonly algunKpi = computed(
    () =>
      this.caps.allows(P.dashboard.kpi.balance) ||
      this.caps.allows(P.dashboard.kpi.ingresos) ||
      this.caps.allows(P.dashboard.kpi.gastos) ||
      this.caps.allows(P.dashboard.kpi.recuento) ||
      (this.customKpis().length > 0 && this.caps.allows(P.dashboard.widget.propios)),
  );
  readonly fixedKpiItems = computed(() =>
    construirKpisFijos({
      allows: (permiso) => this.caps.allows(permiso),
      t: (key) => this.i18n.t(key),
      money: (value) => this.store.money(value),
      periodLabel: this.periodo.periodLabel(),
      net: this.net(),
      income: this.income(),
      expense: this.expense(),
      count: this.movements().length,
      tendencia: (key, formula, valor) => {
        const serie = this.kpiSeriesFor(formula);
        const rangos = this.rangosDe(FIXED_KPI_PREFIX + key, formula);
        return {
          series: serie,
          delta: this.variacion(serie),
          status: estadoDe(valor, rangos),
          ranges: rangos,
          caption: serie.length > 1 ? this.historiaEtiqueta() : '',
        };
      },
    }),
  );
  readonly nadaQueMostrar = computed(
    () =>
      !this.algunKpi() && !this.algunWidget() && !this.caps.allows(P.dashboard.tabla.ver) && !this.puedePersonalizar(),
  );

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

  readonly datos = new DatosDelTablero({
    dimensionKey: (movement, dimension) => this.dimensionKey(movement, dimension),
    typeLabel: (type) => this.typeLabel(type),
    nadaQueMostrar: () => this.nadaQueMostrar(),
  });
  readonly accountId = this.datos.accountId;
  readonly accountType = this.datos.accountType;
  readonly globalCategory = this.datos.globalCategory;
  readonly localCategory = this.datos.localCategory;
  readonly seleccion = this.datos.seleccion;
  readonly historial = this.datos.historial;
  readonly movements = this.datos.movements;
  readonly income = this.datos.income;
  readonly expense = this.datos.expense;
  readonly net = this.datos.net;
  readonly timeline = this.datos.timeline;
  readonly categoryDistribution = this.datos.categoryDistribution;
  readonly accountDistribution = this.datos.accountDistribution;
  readonly hasFilters = this.datos.hasFilters;
  readonly edicion = new EdicionDeWidgets();
  readonly widgets = this.edicion.visibles;
  readonly hidden = this.edicion.ocultos;
  readonly widgetCreatorOpen = signal(false);
  private readonly opcionesDeGraficas = inject(OpcionesDeGraficas);
  readonly opcionDeWidget = (widget: Widget) => this.widgetOption(widget);
  readonly accountTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.accountType.all') },
    { value: 'credit', label: this.i18n.t('dashboard.accountType.credit.plural') },
    { value: 'savings', label: this.i18n.t('dashboard.accountType.savings.plural') },
    { value: 'cash', label: this.i18n.t('dashboard.accountType.cash') },
  ]);
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

  isGeneric(type: WidgetType): boolean {
    return esGenerico(type);
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
  readonly selectedMovement = computed(() => {
    const s = this.store.inspector();
    return s?.type === 'movement' ? this.store.movimiento(s.id) : undefined;
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
  alPulsarPunto(widget: Widget, nombre: string) {
    this.alPulsarDimension(widget.dimension ?? 'category', nombre);
  }
  alPulsarDimension(dimension: Dimension, nombre: string) {
    if (dimension === 'category') return this.datos.alternarCategoria(nombre);
    if (dimension === 'account') {
      const cuenta = this.store.data().accounts.find((a) => a.name === nombre);
      if (cuenta) this.datos.alternarCuenta(cuenta.id);
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
  agregarWidget(widget: Widget): void {
    this.edicion.agregar(widget);
    this.widgetCreatorOpen.set(false);
    this.store.log(this.i18n.t('dashboard.log.widgetAdded', { title: widget.title }));
  }
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
