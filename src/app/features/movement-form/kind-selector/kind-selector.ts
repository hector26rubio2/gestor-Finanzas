import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { IconComponent, IconName } from '../../../ui/icon/icon';

export interface MovementKindOption {
  value: string;
  label: string;
}

const KIND_ICONS: Readonly<Record<string, IconName>> = { expense: 'trendDown', income: 'trendUp' };

@Component({
  selector: 'fin-movement-kind-selector',
  imports: [HlmTabsImports, IconComponent],
  templateUrl: './kind-selector.html',
})
export class MovementKindSelectorComponent {
  @Input({ required: true }) kind!: string;
  @Input({ required: true }) options!: readonly MovementKindOption[];
  @Input() ariaLabel = '';
  @Output() readonly kindChange = new EventEmitter<string>();

  iconOf(value: string): IconName | null {
    return KIND_ICONS[value] ?? null;
  }
}
