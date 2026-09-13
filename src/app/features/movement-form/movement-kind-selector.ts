import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface MovementKindOption {
  value: string;
  label: string;
}

/** Fila de botones para elegir gasto, ingreso o transferencia. */
@Component({
  selector: 'demo-movement-kind-selector',
  standalone: true,
  templateUrl: './movement-kind-selector.html',
})
export class MovementKindSelectorComponent {
  @Input({ required: true }) kind!: string;
  @Input({ required: true }) options!: readonly MovementKindOption[];
  @Input() ariaLabel = '';
  @Output() readonly kindChange = new EventEmitter<string>();
}
