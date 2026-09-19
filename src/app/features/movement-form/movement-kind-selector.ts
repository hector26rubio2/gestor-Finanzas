import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface MovementKindOption {
  value: string;
  label: string;
}

/** Fila de botones para elegir gasto, ingreso o transferencia. */
@Component({
  selector: 'fin-movement-kind-selector',
  standalone: true,
  templateUrl: './movement-kind-selector.html',
  styleUrl: './movement-kind-selector.css',
})
export class MovementKindSelectorComponent {
  @Input({ required: true }) kind!: string;
  @Input({ required: true }) options!: readonly MovementKindOption[];
  @Input() ariaLabel = '';
  @Output() readonly kindChange = new EventEmitter<string>();
}
