import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '../core/api-client';
import { parseMoney, sumBy } from '../core/money';
import { P } from '../core/permissions';
import { sincronizarConLaUrl } from '../core/url-state';
import { CAPABILITIES, DemoStore } from '../core/store';
import { IconComponent } from '../ui/icon';
import { DataTableComponent, KpiComponent, OverlayComponent } from '../ui/ui';
import { UiOption, UiSelectComponent } from '../ui/select';
import { ChartComponent, ChartOption } from '../ui/chart';
import { ChartThemeService } from '../ui/chart-theme';

type Scale = 'day' | 'week' | 'month' | 'year';
type WidgetType = 'flow' | 'trend' | 'categories' | 'accounts' | 'scatter' | 'donut' | 'stacked' | 'heatmap';
type Widget = { id: string; title: string; kicker: string; type: WidgetType; wide: boolean; capability?: string };

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
      this.caps.allows(P.dashboard.kpi.recuento),
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
  newWidgetMetric: WidgetType = 'trend';
  newWidgetWidth = 'wide';
  readonly accountTypeOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'credit', label: 'Tarjetas de crédito' },
    { value: 'savings', label: 'Cuentas de ahorro' },
    { value: 'cash', label: 'Efectivo' },
  ];
  readonly widgetTypeOptions: readonly UiOption[] = [
    { value: 'flow', label: 'Líneas comparativas' },
    { value: 'trend', label: 'Área de tendencia' },
    { value: 'categories', label: 'Barras horizontales' },
    { value: 'accounts', label: 'Tabla resumida' },
    { value: 'scatter', label: 'Dispersión' },
    { value: 'donut', label: 'Composición radial' },
    { value: 'stacked', label: 'Área apilada' },
    { value: 'heatmap', label: 'Mapa de intensidad' },
  ];
  readonly widgetWidthOptions: readonly UiOption[] = [
    { value: 'wide', label: 'Ancho completo' },
    { value: 'half', label: 'Media pantalla' },
  ];
  readonly scales: { value: Scale; label: string }[] = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ];
  readonly all = signal<Widget[]>([
    {
      id: 'flow',
      title: 'Flujo de caja',
      kicker: 'INGRESOS Y GASTOS',
      type: 'flow',
      wide: true,
      capability: P.dashboard.widget.flujo,
    },
    {
      id: 'categories',
      title: 'Gastos por categoría',
      kicker: 'DISTRIBUCIÓN INTERACTIVA',
      type: 'categories',
      wide: false,
      capability: P.dashboard.widget.categorias,
    },
    {
      id: 'accounts',
      title: 'Gasto por cuenta y tarjeta',
      kicker: 'MEDIOS DE PAGO',
      type: 'accounts',
      wide: false,
      capability: P.dashboard.widget.cuentas,
    },
    {
      id: 'trend',
      title: 'Evolución del gasto',
      kicker: 'TENDENCIA',
      type: 'trend',
      wide: true,
      capability: P.dashboard.widget.tendencia,
    },
    {
      id: 'commitments',
      title: 'Disponible tras compromisos',
      kicker: 'PRÓXIMOS 30 DÍAS',
      type: 'accounts',
      wide: false,
      capability: P.dashboard.widget.compromisos,
    },
    {
      id: 'health',
      title: 'Salud financiera',
      kicker: 'ALERTAS Y OPORTUNIDADES',
      type: 'categories',
      wide: false,
      capability: P.dashboard.widget.salud,
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
    { value: 'all', label: 'Todas las cuentas' },
    ...this.accountOptions().map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly categorySelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas las categorías' },
    ...this.allCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly localCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas' },
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
      colors = ['#07836b', '#dc554e', '#d3a34a', '#4e83b5', '#8055a8', '#64748b'];
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
  readonly columns = [
    { key: 'date', label: 'Fecha' },
    { key: 'description', label: 'Descripción' },
    { key: 'category', label: 'Categoría' },
    { key: 'account', label: 'Cuenta' },
    { key: 'amount', label: 'Importe' },
  ];
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
    this.store.log(`Filtro global aplicado: ${this.localCategory()}`);
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
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, type: type as WidgetType } : item)));
  }
  createWidget(event: Event) {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const title = this.newWidgetTitle.trim();
    if (!title) return;
    this.all.update((items) => [
      ...items,
      {
        id: `custom-${Date.now()}`,
        title,
        kicker: 'ANÁLISIS PERSONAL',
        type: this.newWidgetMetric,
        wide: this.newWidgetWidth === 'wide',
      },
    ]);
    this.newWidgetTitle = '';
    this.widgetCreatorOpen.set(false);
    this.store.log(`Widget agregado: ${title}`);
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
      legend: { data: ['Ingresos', 'Gastos'], top: 0, right: 0, textStyle: { color: palette.muted }, icon: 'circle' },
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
          'Ingresos',
          puntos.map((p) => p.income),
          palette.accent,
        ),
        serie(
          'Gastos',
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
          name: 'Gastos',
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
              formatter: 'Promedio ' + this.cifraCorta(promedio),
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
        name: 'Importe',
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
      series: [serie('Ingresos', palette.accent, true), serie('Gastos', palette.danger, false)],
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
        textStyle: { color: palette.muted },
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
            formatter: () => '{valor|' + this.store.money(this.expense()) + '}\n{pie|Gasto total}',
            rich: {
              valor: { color: palette.text, fontSize: 18, fontWeight: 700 },
              pie: { color: palette.muted, fontSize: 12, padding: [6, 0, 0, 0] },
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
      legend: { data: ['Ingresos', 'Gastos'], top: 0, right: 0, textStyle: { color: palette.muted }, icon: 'circle' },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        valueFormatter: (valor: unknown) => this.store.money(Number(valor)),
      },
      series: [
        barra(
          'Gastos',
          puntos.map((p) => p.expense),
          palette.danger,
          false,
        ),
        barra(
          'Ingresos',
          puntos.map((p) => p.income),
          palette.accent,
          true,
        ),
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
        data: ['Movido'],
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
    return (
      ({ credit: 'Tarjeta de crédito', savings: 'Cuenta de ahorro', cash: 'Efectivo' } as Record<string, string>)[
        type
      ] ?? type
    );
  }
  private iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
