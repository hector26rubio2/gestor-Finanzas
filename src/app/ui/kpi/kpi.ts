import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { IconComponent, IconName } from '../icon';
import { ChartComponent } from '../chart';
import { ChartThemeService } from '../chart-theme';

@Component({
  selector: 'fin-kpi',
  standalone: true,
  imports: [ChartComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi.html',
  styleUrl: './kpi.css',
  host: { '[class.bare]': 'bare()' },
})
export class KpiComponent {
  readonly i18n = inject(I18nService);
  readonly label = input('');
  readonly value = input('');
  readonly hint = input('');
  /** Sin su propio borde/fondo/relleno, para vivir dentro de una tarjeta que ya los pone. */
  readonly bare = input(false);
  /** Icono del chip. Sin nombre, la tarjeta no dibuja chip: no todas lo necesitan. */
  readonly icon = input<IconName | ''>('');
  /** Color del chip. «accent» por defecto; «success»/«danger» para ingresos y gastos. */
  readonly tone = input<'accent' | 'success' | 'danger'>('accent');
  /** Serie del periodo para la minigrafica; con menos de dos puntos no se dibuja. */
  readonly series = input<readonly number[]>([]);
  /** Variacion en tanto por ciento frente al intervalo anterior; `null` la oculta. */
  readonly delta = input<number | null>(null);
  /**
   * Si subir es una buena noticia. En ingresos si; en gastos, no. Sin esto la tarjeta
   * pintaria de verde un mes en el que se gasto un tercio mas.
   */
  readonly subirEsBueno = input(true);

  private readonly tema = inject(ChartThemeService);

  readonly mejora = computed(() => {
    const valor = this.delta();
    return valor !== null && valor !== 0 && valor > 0 === this.subirEsBueno();
  });
  readonly empeora = computed(() => {
    const valor = this.delta();
    return valor !== null && valor !== 0 && !(valor > 0 === this.subirEsBueno());
  });
  /**
   * La flecha dice hacia donde se movio la cifra; el color, si eso es buena noticia.
   *
   * Mezclar las dos cosas en la flecha hacia ilegible la tarjeta de gastos: un gasto que
   * bajaba se pintaba con flecha hacia arriba «porque mejora», y junto al numero en
   * valor absoluto se leia exactamente como lo contrario de lo que habia pasado.
   */
  readonly flecha = computed(() => {
    const valor = this.delta();
    if (valor === null || valor === 0) return '▬';
    return valor > 0 ? '▲' : '▼';
  });
  readonly deltaTitulo = computed(() => {
    const valor = this.delta();
    if (valor === null) return '';
    const params = { value: this.deltaTexto() };
    return valor > 0 ? this.i18n.t('kpi.delta.more', params) : this.i18n.t('kpi.delta.less', params);
  });
  readonly deltaTexto = computed(() => {
    const valor = this.delta();
    if (valor === null) return '';
    return `${Math.abs(valor).toFixed(Math.abs(valor) >= 10 ? 0 : 1)}%`;
  });

  readonly chispaOption = computed(() => {
    const palette = this.tema.palette();
    const color = this.empeora() ? palette.danger : palette.accent;
    const valores = [...this.series()];
    return {
      grid: { top: 4, right: 2, bottom: 2, left: 2 },
      xAxis: {
        type: 'category' as const,
        show: true,
        boundaryGap: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        data: valores.map((_, i) => i),
      },
      yAxis: { type: 'value' as const, show: false, min: Math.min(...valores), max: Math.max(...valores, 1) },
      tooltip: { show: false },
      series: [
        {
          type: 'line' as const,
          data: valores,
          smooth: 0.3,
          showSymbol: false,
          lineStyle: { width: 1.8, color },
          areaStyle: { color: `color-mix(in srgb, ${color} 16%, transparent)` },
          silent: true,
        },
      ],
    };
  });
}
