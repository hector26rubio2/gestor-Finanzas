import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

export interface MovementKindOption {
  value: string;
  label: string;
}

/** Fila de botones para elegir gasto, ingreso o transferencia. */
@Component({
  selector: 'fin-movement-kind-selector',
  imports: [HlmButton],
  templateUrl: './movement-kind-selector.html',
})
export class MovementKindSelectorComponent {
  @Input({ required: true }) kind!: string;
  @Input({ required: true }) options!: readonly MovementKindOption[];
  @Input() ariaLabel = '';
  @Output() readonly kindChange = new EventEmitter<string>();
}
