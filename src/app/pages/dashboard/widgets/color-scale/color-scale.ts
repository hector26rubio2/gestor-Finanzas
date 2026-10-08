import { Component, input } from '@angular/core';

@Component({
  selector: 'fin-color-scale',
  host: { class: 'flex flex-1' },
  templateUrl: './color-scale.html',
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
