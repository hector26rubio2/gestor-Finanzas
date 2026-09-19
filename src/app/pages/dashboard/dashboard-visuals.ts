import { Signal, WritableSignal, computed, inject } from '@angular/core';
import { Movement } from '../../core/state/demo-data';
import { I18nService } from '../../core/i18n';
import { sumBy } from '../../core/utils/money';
import {} from '../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../core/state/store';
import { UiOption } from '../../ui/select/select';
import { ChartOption } from '../../ui/chart/chart';
import { ChartThemeService } from '../../ui/chart/chart-theme';
import { CategorySlice, Dimension, Measure, Scale, TimelinePoint, Widget } from './dashboard.model';
import { cifraCorta, conAlfa, degradado, ejesDeIntervalo } from './dashboard-chart-style';

export abstract class DashboardVisuals {
  readonly store = inject(AppStore);
  readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  protected readonly temaGrafica = inject(ChartThemeService);
  abstract readonly scale: WritableSignal<Scale>;
  abstract readonly anchor: WritableSignal<string>;
  abstract readonly movements: Signal<readonly Movement[]>;
  abstract readonly timeline: Signal<readonly TimelinePoint[]>;
  abstract readonly categoryDistribution: Signal<readonly CategorySlice[]>;
  abstract readonly income: Signal<number>;
  abstract readonly expense: Signal<number>;
  abstract readonly net: Signal<number>;
  abstract readonly measureOptions: Signal<readonly UiOption[]>;

  protected iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      areaStyle: { color: degradado(color) },
      emphasis: { focus: 'series' as const, showSymbol: true },
      data: valores,
    });
    return {
      ...ejesDeIntervalo(
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
                fillerColor: conAlfa(palette.accent, 0.14),
                dataBackground: {
                  lineStyle: { color: palette.line },
                  areaStyle: { color: conAlfa(palette.accent, 0.1) },
                },
                selectedDataBackground: {
                  lineStyle: { color: palette.accent },
                  areaStyle: { color: conAlfa(palette.accent, 0.18) },
                },
                handleStyle: { color: palette.surface, borderColor: palette.accent },
                moveHandleStyle: { color: conAlfa(palette.accent, 0.4) },
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
      ...ejesDeIntervalo(
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
          areaStyle: { color: degradado(palette.accent) },
          data: gastos,
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              formatter: this.i18n.t('dashboard.chart.average', { value: cifraCorta(promedio) }),
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
        axisLabel: { color: palette.muted, formatter: (valor: number) => cifraCorta(valor) },
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
              '{valor|' +
              this.store.money(this.expense()) +
              '}\n{pie|' +
              this.i18n.t('dashboard.widget.donut.totalLabel') +
              '}',
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
      ...ejesDeIntervalo(
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
                [0.1, conAlfa(palette.danger, 0.75)],
                [0.2, conAlfa(palette.warn, 0.75)],
                [1, conAlfa(palette.accent, 0.75)],
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
        formatter: (valor: number) => cifraCorta(valor),
        inRange: { color: [conAlfa(palette.accent, 0.12), palette.accent] },
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
    const etiquetas = conteo.map((_, i) => `${cifraCorta(i * ancho)}–${cifraCorta((i + 1) * ancho)}`);
    return {
      ...ejesDeIntervalo(palette, etiquetas),
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
  protected dimensionKey(m: Movement, dim: Dimension): { key: string; label: string } {
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
            ? this.kindLabel(m)
            : dim === 'recurring'
              ? this.i18n.t(
                  m.recurring ? 'dashboard.dimension.recurring.fixed' : 'dashboard.dimension.recurring.variable',
                )
              : dim === 'installments'
                ? this.i18n.t(
                    (m.installmentTotal ?? 1) > 1
                      ? 'dashboard.dimension.installments.yes'
                      : 'dashboard.dimension.installments.no',
                  )
                : (m.person ?? this.i18n.t('dashboard.person.none'));
    return { key: label, label };
  }
  /**
   * Transferencia y avance ya no son su propia clase de movimiento (`kind` es
   * `expense`/`income` como cualquier otro), así que hay que mirar `movementSubtype`
   * primero o un widget partido por "tipo" mostraría un gasto de transferencia
   * mezclado con los gastos reales, perdiendo justo la distinción que antes daba
   * `kind === 'transfer'`.
   */
  protected kindLabel(m: Movement): string {
    if (m.movementSubtype === 'transfer') return this.i18n.t('dashboard.movement.kind.transfer');
    if (m.movementSubtype === 'advance') return this.i18n.t('dashboard.movement.kind.advance');
    const etiquetas: Record<string, string> = {
      income: this.i18n.t('dashboard.movement.kind.income'),
      expense: this.i18n.t('dashboard.movement.kind.expense'),
      payment: this.i18n.t('dashboard.movement.kind.payment'),
    };
    return etiquetas[m.kind] ?? m.kind;
  }
  /**
   * `expense`/`income` se basan en el signo del importe, no en `kind`: un widget puede
   * partir la misma medida por `kind` como serie (dimension2), y si "gasto" filtrara otra
   * vez por `kind === 'expense'` las series de pago/transferencia saldrían siempre en cero
   * -su filtro y el de la medida se pisan-. El signo no tiene ese problema y es la misma
   * idea de fondo: dinero que sale es gasto, dinero que entra es ingreso.
   */
  protected measureValue(rows: readonly Movement[], measure: Measure): number {
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
  protected aggregate(widget: Pick<Widget, 'dimension' | 'measure'>): { key: string; label: string; value: number }[] {
    const dim = widget.dimension ?? 'category';
    const measure = widget.measure ?? 'expense';
    const grupos = new Map<string, { label: string; filas: Movement[] }>();
    for (const m of this.movements()) {
      const { key, label } = this.dimensionKey(m, dim);
      const entrada = grupos.get(key) ?? { label, filas: [] };
      entrada.filas.push(m);
      grupos.set(key, entrada);
    }
    const filas = [...grupos].map(([key, { label, filas }]) => ({
      key,
      label,
      value: this.measureValue(filas, measure),
    }));
    return dim === 'date' ? filas.sort((a, b) => a.key.localeCompare(b.key)) : filas.sort((a, b) => b.value - a.value);
  }
  /**
   * Igual que `aggregate` pero cruzando dos dimensiones: una para el eje y otra para la
   * serie (columnas agrupadas/apiladas, mapa de calor). Las categorías del eje ordenan
   * como en `aggregate`; las series ordenan alfabéticamente, que es estable y predecible.
   */
  protected aggregate2D(widget: Widget): { categories: string[]; series: { name: string; data: number[] }[] } {
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
          ...ejesDeIntervalo(
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
              areaStyle: widget.type === 'area' ? { color: degradado(palette.accent) } : undefined,
              data: agg.map((a) => a.value),
            },
          ],
        };
      }
      case 'bar':
      case 'barH': {
        const agg = this.aggregate(widget).slice(0, 12);
        const horizontal = widget.type === 'barH';
        // ECharts ordena la fuente declarativamente antes de pintarla. Esto deja la
        // agregación en el componente y el ordenamiento en el motor de gráficos, y
        // permite reutilizar el mismo dataset cuando añadamos filtros o series.
        // Referencia: https://echarts.apache.org/handbook/en/concepts/data-transform
        const source = [['label', 'value'], ...agg.map((item) => [item.label, item.value])];
        const ejeCategoria = {
          type: 'category' as const,
          axisLine: { lineStyle: { color: palette.line } },
          axisTick: { show: false },
          axisLabel: { color: palette.muted, hideOverlap: true },
        };
        const ejeValor = {
          type: 'value' as const,
          splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
          axisLabel: { color: palette.muted, formatter: (v: number) => cifraCorta(v) },
        };
        return {
          grid: horizontal
            ? { top: 10, right: 24, bottom: 10, left: 110, containLabel: true }
            : { top: 20, right: 18, bottom: 34, left: 62 },
          xAxis: horizontal ? ejeValor : ejeCategoria,
          yAxis: horizontal ? ejeCategoria : ejeValor,
          dataset: [
            { id: 'bar-source', source },
            {
              id: 'bar-sorted',
              fromDatasetId: 'bar-source',
              transform: { type: 'sort', config: { dimension: 'value', order: 'desc' } },
            },
          ],
          tooltip: { trigger: 'axis' as const, valueFormatter },
          series: [
            {
              type: 'bar' as const,
              datasetId: 'bar-sorted',
              encode: horizontal ? { x: 'value', y: 'label' } : { x: 'label', y: 'value' },
              barMaxWidth: 26,
              itemStyle: {
                color: palette.accent,
                borderRadius: (horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]) as [number, number, number, number],
              },
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
          ...ejesDeIntervalo(palette, categories),
          legend: {
            data: series.map((s) => s.name),
            top: 0,
            right: 0,
            textStyle: { color: palette.muted },
            icon: 'circle',
          },
          tooltip: {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            valueFormatter: porcentaje ? (v: unknown) => `${Number(v).toFixed(0)}%` : valueFormatter,
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
          tooltip: {
            formatter: (p: { name: string; value: number }) =>
              `${p.name}<br/><b>${this.formatMeasure(p.value, widget)}</b>`,
          },
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
          tooltip: {
            formatter: (p: { name: string; value: number }) =>
              `${p.name}<br/><b>${this.formatMeasure(p.value, widget)}</b>`,
          },
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
          delta.push({
            value: Math.abs(a.value),
            itemStyle: { color: a.value >= 0 ? palette.accent : palette.danger },
          });
          acumulado += a.value;
        }
        return {
          ...ejesDeIntervalo(
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
            formatter: (v: number) => cifraCorta(v),
            inRange: { color: [conAlfa(palette.accent, 0.12), palette.accent] },
          },
          tooltip: {
            formatter: (p: { value: [number, number, number] }) =>
              `${categories[p.value[0]]} · ${series[p.value[1]].name}<br/><b>${this.formatMeasure(p.value[2], widget)}</b>`,
          },
          series: [
            { type: 'heatmap' as const, data: celdas, itemStyle: { borderColor: palette.surface, borderWidth: 2 } },
          ],
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
  protected indicatorZones(min: number, max: number, meta: number): { low: number; mid: number } {
    const fraccionMeta = max > min ? Math.min(1, Math.max(0, (meta - min) / (max - min))) : 0;
    return { low: fraccionMeta * 0.5, mid: fraccionMeta };
  }
  protected indicatorScale(widget: Widget): { min: number; max: number; meta: number; valor: number } {
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
    if (valorFraccion < low)
      return { label: this.i18n.t('dashboard.indicator.status.critical'), color: palette.danger };
    if (valorFraccion < mid) return { label: this.i18n.t('dashboard.indicator.status.warning'), color: palette.warn };
    return { label: this.i18n.t('dashboard.indicator.status.good'), color: palette.success };
  }
  /**
   * Indicador con meta: valor actual, mínimo, máximo y meta, cada uno con su color -tal
   * como el "Indicador KPI" de Power BI. Tres tramos de fondo (rojo/ámbar/verde) marcan
   * critico/alerta/bueno igual que la referencia; el arco relleno toma el mismo color que
   * el tramo donde cae el valor, y la aguja marca la meta en sí, encima de todo.
   */
  protected indicatorOption(widget: Widget): ChartOption {
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
                [low, conAlfa(palette.danger, 0.35)],
                [mid, conAlfa(palette.warn, 0.35)],
                [1, conAlfa(palette.success, 0.35)],
              ],
            },
          },
          pointer: { show: false },
          anchor: { show: false },
          axisTick: { show: false },
          splitLine: { distance: -18, length: 10, lineStyle: { color: palette.surface, width: 2 } },
          axisLabel: { distance: 26, color: palette.muted, fontSize: 10, formatter: (v: number) => cifraCorta(v) },
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
            {
              value: valor,
              name: this.i18n.t('dashboard.widget.indicator.metaLabel', { value: this.formatMeasure(meta, widget) }),
            },
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
  statusBarsRows(
    widget: Widget,
  ): { label: string; valueLabel: string; percent: number; tone: 'success' | 'warn' | 'danger' }[] {
    const filas = this.aggregate(widget).slice(0, 6);
    const max = Math.max(1, ...filas.map((f) => Math.abs(f.value)));
    return filas.map((f) => {
      const percent = Math.min(100, Math.max(0, (Math.abs(f.value) / max) * 100));
      const tone = percent >= 66 ? 'success' : percent >= 33 ? 'warn' : 'danger';
      return { label: f.label, valueLabel: this.formatMeasure(f.value, widget), percent, tone };
    });
  }
  /** Total agregado de un widget "tarjeta": toda la dimensión colapsada en un solo número. */
  cardValue(widget: Widget): number {
    return this.measureValue(this.movements(), widget.measure ?? 'expense');
  }
  measureLabel(widget: Widget): string {
    return this.measureOptions().find((o) => o.value === (widget.measure ?? 'expense'))?.label ?? '';
  }
}
