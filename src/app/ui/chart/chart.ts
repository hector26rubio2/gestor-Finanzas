import { Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { I18nService } from '@core/i18n';
import { ChartThemeService } from './chart-theme';
import { cargarModulos, modulosFaltantes } from './chart-modulos';

echarts.use([
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  ScatterChart,
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type ChartOption = Parameters<echarts.ECharts['setOption']>[0];

@Component({
  selector: 'fin-chart',
  host: {
    class: 'block w-full',
    '[class.h-full]': 'llena()',
    '[class.min-h-40]': 'llena()',
    '[class.flex-1]': 'llena()',
  },
  template: `<div class="lienzo w-full" role="img" [attr.aria-label]="ariaLabel()"></div>`,
})
export class ChartComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  readonly option = input.required<ChartOption>();
  readonly height = input<number | 'fill'>(260);
  readonly llena = computed(() => this.height() === 'fill');
  readonly ariaLabel = input(this.i18n.t('chart.defaultAriaLabel'));
  readonly pick = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly tema = inject(ChartThemeService);
  private grafica: echarts.ECharts | null = null;
  private observador: ResizeObserver | null = null;
  private readonly modulosListos = signal(0);

  private readonly base = computed(() => {
    const p = this.tema.palette();
    return {
      color: [...p.categorical],
      textStyle: { color: p.muted, fontFamily: 'inherit' },
      tooltip: {
        backgroundColor: p.surface,
        borderColor: p.line,
        textStyle: { color: p.text },
        extraCssText: 'box-shadow: 0 18px 45px rgba(0,0,0,.16); border-radius: 12px;',
        confine: true,
      },
      animationDuration: 520,
      animationEasing: 'cubicOut' as const,
      animationDurationUpdate: 360,
    };
  });

  constructor() {
    effect(() => {
      const option = this.option();
      const base = this.base();
      this.modulosListos();
      const faltan = modulosFaltantes(option as object);
      if (faltan.length) {
        void cargarModulos(faltan).then(() => this.modulosListos.update((valor) => valor + 1));
        return;
      }
      const alto = this.height();
      const lienzo = this.host.nativeElement.querySelector('.lienzo') as HTMLElement | null;
      if (!lienzo) return;
      lienzo.style.height = alto === 'fill' ? '100%' : `${alto}px`;
      if (!this.hayLienzo2d()) return;
      if (!this.grafica) {
        this.grafica = echarts.init(lienzo, undefined, { renderer: 'canvas', width: 'auto', height: 'auto' });
        this.grafica.on('click', (evento: { name?: string; data?: unknown }) => {
          const id = (evento.data as { id?: string } | undefined)?.id;
          const elegido = id ?? evento.name;
          if (elegido) this.pick.emit(elegido);
        });
        if (typeof ResizeObserver === 'function') {
          this.observador = new ResizeObserver(() => this.grafica?.resize());
          this.observador.observe(lienzo);
        }
      }
      this.grafica.resize();
      const reduceMotion =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const propia = option as { tooltip?: object };
      this.grafica.setOption(
        {
          ...base,
          ...(option as object),
          tooltip: { ...base.tooltip, ...(propia.tooltip ?? {}) },
          ...(reduceMotion ? { animation: false } : {}),
        },
        true,
      );
    });
  }

  private hayLienzo2d(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      return !!document.createElement('canvas').getContext('2d');
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.grafica?.dispose();
    this.grafica = null;
  }
}
