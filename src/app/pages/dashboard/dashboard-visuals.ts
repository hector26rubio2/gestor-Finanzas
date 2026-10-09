import { Signal, WritableSignal, computed, inject } from '@angular/core';
import { Movement, CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { UiOption } from '@ui/select';
import { ChartOption, ChartThemeService } from '@ui/chart';
import {
  ContextoDeGrafica,
  opcionApilada,
  opcionDeAnillo,
  opcionDeDispersion,
  opcionDeFlujo,
  opcionDeHistograma,
  opcionDeIntensidad,
  opcionDeMedidor,
  opcionDeTendencia,
} from './graficas-fijas';
import { CategorySlice, Dimension, Measure, Scale, TimelinePoint, Widget } from '@shared/tablero/dashboard.model';
import {
  cifraCorta,
  conAlfa,
  ContextoDeDatos,
  agregar,
  etiquetaDeDimension,
  valorDeMedida,
  TIPOS_DEL_MOTOR,
  construirVisual,
  crearContextoDeDatos,
  etiquetaDeTipoDeMovimiento,
} from '@shared/graficas';
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

  protected contextoDeGrafica(): ContextoDeGrafica {
    return {
      palette: this.temaGrafica.palette(),
      t: (key, params) => this.i18n.t(key, params),
      money: (value) => this.store.money(value),
    };
  }

  protected iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  readonly flujoOption = computed<ChartOption>(() => opcionDeFlujo(this.contextoDeGrafica(), this.timeline()));

  readonly tendenciaOption = computed<ChartOption>(() => opcionDeTendencia(this.contextoDeGrafica(), this.timeline()));

  readonly dispersionOption = computed<ChartOption>(() =>
    opcionDeDispersion(this.contextoDeGrafica(), this.movements()),
  );

  readonly anilloOption = computed<ChartOption>(() =>
    opcionDeAnillo(this.contextoDeGrafica(), this.categoryDistribution(), this.expense()),
  );

  readonly apiladoOption = computed<ChartOption>(() => opcionApilada(this.contextoDeGrafica(), this.timeline()));

  readonly tasaDeAhorro = computed(() => {
    const entra = this.income();
    if (entra <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.net() / entra) * 100)));
  });

  readonly medidorOption = computed<ChartOption>(() => opcionDeMedidor(this.contextoDeGrafica(), this.tasaDeAhorro()));

  readonly intensidadOption = computed<ChartOption>(() =>
    opcionDeIntensidad(this.contextoDeGrafica(), this.timeline()),
  );

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
  readonly histogramaOption = computed<ChartOption>(() =>
    opcionDeHistograma(this.contextoDeGrafica(), this.cubetasDelHistograma()),
  );

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
    return (widget.measure ?? 'expense') === 'count' ? this.store.number(value) : this.store.money(value);
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
  colorScalePercent(widget: Widget): number {
    const { min, max, valor } = this.indicatorScale(widget);
    return max > min ? Math.min(100, Math.max(0, ((valor - min) / (max - min)) * 100)) : 0;
  }
  colorScaleMetaPercent(widget: Widget): number {
    const { min, max, meta } = this.indicatorScale(widget);
    return max > min ? Math.min(100, Math.max(0, ((meta - min) / (max - min)) * 100)) : 0;
  }
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
  cardValue(widget: Widget): number {
    return this.measureValue(this.movements(), widget.measure ?? 'expense');
  }
  measureLabel(widget: Widget): string {
    return this.measureOptions().find((o) => o.value === (widget.measure ?? 'expense'))?.label ?? '';
  }
}
