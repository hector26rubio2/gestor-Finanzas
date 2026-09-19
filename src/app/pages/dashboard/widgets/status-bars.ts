import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StatusBarRow {
  label: string;
  valueLabel: string;
  percent: number;
  tone: 'success' | 'warn' | 'danger';
}

/** Varias medidas del mismo widget, cada una como su propia barra de progreso. */
@Component({
  selector: 'fin-status-bars',
  standalone: true,
  templateUrl: './status-bars.html',
  styleUrl: './status-bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarsComponent {
  readonly rows = input<readonly StatusBarRow[]>([]);
  readonly emptyText = input('');
}
