import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Medidor de una meta como barra plana: valor actual, rango mín/meta/máx y una píldora de estado. */
@Component({
  selector: 'fin-color-scale',
  host: { class: 'flex flex-1' },
  templateUrl: './color-scale.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorScaleComponent {
  readonly value = input('');
  readonly label = input('');
  readonly min = input('');
  readonly target = input('');
  readonly max = input('');
  readonly pointerPercent = input(0);
  readonly metaPercent = input(0);
  readonly statusLabel = input('');
  readonly statusColor = input('');
}
