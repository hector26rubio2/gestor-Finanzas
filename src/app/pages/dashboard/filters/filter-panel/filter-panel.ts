import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { IconComponent } from '../../../../ui/icon/icon';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { BrnCollapsible, BrnCollapsibleContent, BrnCollapsibleTrigger } from '@spartan-ng/brain/collapsible';

export type Scale = 'day' | 'week' | 'month' | 'year';

/**
 * Panel de filtros del dashboard: escala de periodo, navegador de periodo con su
 * menu de año/mes/semana/dia, y los tres selects de cuenta/tipo/categoria. Antes
 * vivia entero en dashboard.html; quien filtra que decide el padre, esto solo
 * dibuja el estado que ya se le paso.
 */
function pantallaEstrecha(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 780px)').matches
    : false;
}

@Component({
  selector: 'fin-filter-panel',
  imports: [
    HlmButton,
    HlmInput,
    HlmPopoverImports,
    HlmToggleGroupImports,
    FormsModule,
    IconComponent,
    UiSelectComponent,
    BrnCollapsible,
    BrnCollapsibleContent,
    BrnCollapsibleTrigger,
  ],
  templateUrl: './filter-panel.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterPanelComponent {
  readonly scales = input.required<readonly { value: Scale; label: string }[]>();
  readonly scale = input.required<Scale>();
  readonly hasFilters = input(false);
  readonly periodPickerOpen = input(false);
  readonly periodShortLabel = input('');
  readonly anchorYear = input('');
  readonly anchorMonth = input('');
  readonly anchorDay = input('');
  readonly anchorWeekOfMonth = input('');
  readonly monthOptions = input<readonly UiOption[]>([]);
  readonly weekOfMonthOptions = input<readonly UiOption[]>([]);
  readonly accountId = input('all');
  readonly accountSelectOptions = input<readonly UiOption[]>([]);
  readonly accountType = input('all');
  readonly accountTypeOptions = input<readonly UiOption[]>([]);
  readonly globalCategory = input('all');
  readonly categorySelectOptions = input<readonly UiOption[]>([]);
  readonly periodLabel = input('');
  readonly movementsCount = input(0);
  readonly filtersExpanded = signal(!pantallaEstrecha());

  readonly i18n = inject(I18nService);

  onScale(value: unknown): void {
    if (typeof value === 'string' && value !== this.scale()) this.scaleChange.emit(value as Scale);
  }

  onPickerState(state: 'open' | 'closed'): void {
    if ((state === 'open') !== this.periodPickerOpen()) this.togglePeriodPicker.emit();
  }

  @Output() readonly clear = new EventEmitter<void>();
  @Output() readonly scaleChange = new EventEmitter<Scale>();
  @Output() readonly shiftPeriod = new EventEmitter<number>();
  @Output() readonly togglePeriodPicker = new EventEmitter<void>();
  @Output() readonly closePeriodPicker = new EventEmitter<void>();
  @Output() readonly yearChange = new EventEmitter<string>();
  @Output() readonly monthChange = new EventEmitter<string>();
  @Output() readonly weekOfMonthChange = new EventEmitter<string>();
  @Output() readonly dayChange = new EventEmitter<string>();
  @Output() readonly accountIdChange = new EventEmitter<string>();
  @Output() readonly accountTypeChange = new EventEmitter<string>();
  @Output() readonly globalCategoryChange = new EventEmitter<string>();
}
