import { Signal, WritableSignal, computed, inject } from '@angular/core';
import { Movement, CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { UiOption } from '@ui/select';
import { ChartOption, ChartThemeService } from '@ui/chart';
import { CategorySlice, Dimension, Measure, Scale, TimelinePoint, Widget } from './dashboard.model';
import { cifraCorta, conAlfa, degradado, ejesDeIntervalo, ContextoDeDatos, agregar, etiquetaDeDimension, valorDeMedida, TIPOS_DEL_MOTOR, construirVisual, crearContextoDeDatos, etiquetaDeTipoDeMovimiento } from '@shared/graficas';
import type { Granularidad, TipoVisual } from '@shared/graficas';

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
        .map((m) => ({ value: [m.date, Math.abs(m.amount)], name: m.description, id: m.id })),
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
  readonly cubetasDelHistograma = computed(() => {
    const montos = this.movements()
      .map((m) => Math.abs(m.amount))
      .filter((v) => v > 0);
    const max = Math.max(0, ...montos);
    const cubetas = 8;
    const ancho = max / cubetas || 1;
    const conteo = Array.from({ length: cubetas }, () => 0);
    for (const valor of montos) conteo[Math.min(cubetas - 1, Math.floor(valor / ancho))]++;
    const etiquetas = conteo.map((_, i) => `${cifraCorta(i * ancho)}–${cifraCorta((i + 1) * ancho)}`);
    return { montos, ancho, conteo, etiquetas, cubetas };
  });
  readonly histogramaOption = computed<ChartOption>(() => {
    const palette = this.temaGrafica.palette();
    const { montos, conteo, etiquetas } = this.cubetasDelHistograma();
    if (!montos.length) return { series: [] };
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

  protected granularidadDe(widget?: Pick<Widget, 'granularity'>): Granularidad {
    if (widget?.granularity) return widget.granularity;
    return this.scale() === 'year' ? 'month' : 'day';
  }

  protected contextoDeDatos(granularidad: Granularidad = this.granularidadDe()): ContextoDeDatos {
    return crearContextoDeDatos(this.store, this.i18n, granularidad);
  }

  protected dimensionKey(m: Movement, dim: Dimension): { key: string; label: string } {
    return etiquetaDeDimension(m, dim, this.contextoDeDatos());
  }

  protected kindLabel(m: Movement): string {
    return etiquetaDeTipoDeMovimiento(m, this.i18n);
  }

  protected measureValue(rows: readonly Movement[], measure: Measure): number {
    return valorDeMedida(rows, measure);
  }

  formatMeasure(value: number, widget: Pick<Widget, 'measure'>): string {
    return (widget.measure ?? 'expense') === 'count' ? Math.round(value).toLocaleString() : this.store.money(value);
  }

  protected aggregate(
    widget: Pick<Widget, 'dimension' | 'measure' | 'granularity'>,
  ): { key: string; label: string; value: number }[] {
    return agregar(
      this.movements(),
      widget.dimension ?? 'category',
      widget.measure ?? 'expense',
      this.contextoDeDatos(this.granularidadDe(widget)),
    );
  }

  widgetOption(widget: Widget): ChartOption {
    if (widget.type === 'indicator') return this.indicatorOption(widget);
    if (!TIPOS_DEL_MOTOR.has(widget.type)) return { series: [] };
    return construirVisual({
      config: { ...widget, tipo: widget.type as TipoVisual },
      movs: this.movements(),
      entorno: {
        palette: this.temaGrafica.palette(),
        ctx: this.contextoDeDatos(this.granularidadDe(widget)),
        dinero: (valor) => this.store.money(valor),
        titulo: widget.title,
      },
    });
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
