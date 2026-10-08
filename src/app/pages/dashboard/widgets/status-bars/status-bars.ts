import { Component, input } from '@angular/core';

export interface StatusBarRow {
  label: string;
  valueLabel: string;
  percent: number;
  tone: 'success' | 'warn' | 'danger';
}

@Component({
  selector: 'fin-status-bars',
  host: { class: 'flex flex-1' },
  templateUrl: './status-bars.html',
})
export class StatusBarsComponent {
  readonly rows = input<readonly StatusBarRow[]>([]);
  readonly emptyText = input('');
}
