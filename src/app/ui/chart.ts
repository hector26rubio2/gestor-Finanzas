import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import * as echarts from 'echarts/core';
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { I18nService } from '../core/i18n';
import { ChartThemeService } from './chart-theme';

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type ChartOption = Parameters<echarts.ECharts['setOption']>[0];

/**
 * Una gráfica del tablero.
 *
 * El lienzo se pinta fuera de Angular y no entiende de variables CSS, así que este
 * envoltorio se ocupa de las tres cosas que hay que recordar en cada gráfica: pintar los
 * ejes y el tooltip con los colores del tema vigente, seguir el tamaño del contenedor
 * —las tarjetas del tablero cambian de ancho al contraer el menú— y soltar la instancia
 * al destruirse. Cada widget solo describe sus series.
 *
 * El texto alternativo no es decorativo: el lienzo es opaco para un lector de pantalla,
 * de modo que quien no ve la gráfica necesita la frase que la resume.
 */
@Component({
  selector: 'fin-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart.html',
  styleUrl: './chart.css',
})
export class ChartComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  readonly option = input.required<ChartOption>();
  readonly height = input(260);
  readonly ariaLabel = input(this.i18n.t('chart.defaultAriaLabel'));
  /** Nombre de la porción o punto pulsado, para las gráficas que filtran al tocarlas. */
  readonly pick = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly tema = inject(ChartThemeService);
  private grafica: echarts.ECharts | null = null;
  private observador: ResizeObserver | null = null;

  /** La base que comparten todas: ejes tenues, tooltip del tema y sin título propio. */
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
      },
      animationDuration: 420,
    };
  });

  constructor() {
    effect(() => {
      const option = this.option();
      const base = this.base();
      const alto = this.height();
      const lienzo = this.host.nativeElement.querySelector('.lienzo') as HTMLElement | null;
      if (!lienzo) return;
      lienzo.style.height = `${alto}px`;
      // Sin lienzo 2D no hay nada que pintar: jsdom devuelve un `canvas` sin contexto, y
      // ECharts revienta al primer refresco. El texto alternativo del contenedor sigue
      // ahi, que es lo unico que una prueba de plantilla necesita comprobar.
      if (!this.hayLienzo2d()) return;
      if (!this.grafica) {
        // `width`/`height` en `'auto'`, nunca un numero: ECharts guarda lo que sea que se
        // le pase aqui y un `resize()` posterior sin argumentos reusa ese valor guardado en
        // vez de volver a medir el contenedor -pasar un numero de partida deja la grafica
        // clavada a ese ancho para siempre, aunque la tarjeta cambie de tamaño despues (el
        // caso real: una tarjeta "wide" que todavia no ocupaba las dos columnas del grid
        // cuando ECharts midio por primera vez). Con `'auto'`, cada `resize()` -el
        // del observador de aqui abajo y el de cada refresco de opcion- vuelve a leer el
        // ancho/alto reales del contenedor.
        this.grafica = echarts.init(lienzo, undefined, { renderer: 'canvas', width: 'auto', height: 'auto' });
        this.grafica.on('click', (evento: { name?: string }) => {
          if (evento.name) this.pick.emit(evento.name);
        });
        // `ResizeObserver` falta en jsdom y en webviews viejas; sin el la grafica no vuelve
        // a medir el contenedor tras el montaje inicial.
        if (typeof ResizeObserver === 'function') {
          this.observador = new ResizeObserver(() => this.grafica?.resize());
          this.observador.observe(lienzo);
        }
      }
      this.grafica.resize();
      // `true` reemplaza: al cambiar de tipo de widget o de periodo, las series viejas no
      // deben sobrevivir mezcladas con las nuevas.
      const reduceMotion =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.grafica.setOption({ ...base, ...(option as object), ...(reduceMotion ? { animation: false } : {}) }, true);
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
