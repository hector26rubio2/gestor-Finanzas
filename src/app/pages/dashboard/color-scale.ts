import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Medidor de una meta como barra plana: valor actual, rango mín/meta/máx y una píldora de estado. */
@Component({
  selector: 'demo-color-scale',
  standalone: true,
  templateUrl: './color-scale.html',
  styleUrl: './color-scale.css',
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
