import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { IconComponent } from '@ui/icon';
import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { UiOption, UiSelectComponent } from '@ui/select';
import { NumericInputDirective } from '@ui/numeric-input';

export type Scale = 'day' | 'week' | 'month' | 'year';

type FiltroClave = 'account' | 'accountType' | 'category';

interface FiltroDelPanel {
  key: FiltroClave;
  label: string;
  ariaLabel: string;
  value: string;
  selected: string;
  options: readonly UiOption[];
}

const ANIOS_ATRAS = 15;

@Component({
  selector: 'fin-filter-panel',
  imports: [
    NumericInputDirective,
    HlmButton,
    HlmDropdownMenuImports,
    HlmInput,
    HlmPopoverImports,
    HlmToggleGroupImports,
    FormsModule,
    IconComponent,
    UiSelectComponent,
  ],
  templateUrl: './filter-panel.html',
  host: { style: 'display: contents' },
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
  readonly selectionLabel = input('');

  readonly i18n = inject(I18nService);

  readonly yearOptions = computed<readonly UiOption[]>(() => {
    const actual = new Date().getFullYear();
    const elegido = Number(this.anchorYear()) || actual;
    const desde = Math.min(elegido, actual - ANIOS_ATRAS);
    const hasta = Math.max(elegido, actual + 1);
    return Array.from({ length: hasta - desde + 1 }, (_, indice) => {
      const anio = String(hasta - indice);
      return { value: anio, label: anio };
    });
  });

  readonly filtros = computed<readonly FiltroDelPanel[]>(() => {
    const armar = (key: FiltroClave, clave: string, value: string, opciones: readonly UiOption[]): FiltroDelPanel => ({
      key,
      label: this.i18n.t(`dashboard.filters.${clave}.label`),
      ariaLabel: this.i18n.t(`dashboard.filters.${clave}.ariaLabel`),
      value,
      selected: opciones.find((opcion) => opcion.value === value)?.label ?? value,
      options: opciones.filter((opcion) => opcion.value !== 'all'),
    });
    return [
      armar('account', 'account', this.accountId(), this.accountSelectOptions()),
      armar('accountType', 'accountType', this.accountType(), this.accountTypeOptions()),
      armar('category', 'category', this.globalCategory(), this.categorySelectOptions()),
    ];
  });

  onScale(value: unknown): void {
    if (typeof value === 'string' && value !== this.scale()) this.scaleChange.emit(value as Scale);
  }

  onPickerState(state: 'open' | 'closed'): void {
    if ((state === 'open') !== this.periodPickerOpen()) this.togglePeriodPicker.emit();
  }

  cambiar(clave: FiltroClave, valor: string): void {
    if (clave === 'account') this.accountIdChange.emit(valor);
    else if (clave === 'accountType') this.accountTypeChange.emit(valor);
    else this.globalCategoryChange.emit(valor);
  }

  readonly clear = output<void>();
  readonly clearSelection = output<void>();
  readonly scaleChange = output<Scale>();
  readonly shiftPeriod = output<number>();
  readonly togglePeriodPicker = output<void>();
  readonly closePeriodPicker = output<void>();
  readonly yearChange = output<string>();
  readonly monthChange = output<string>();
  readonly weekOfMonthChange = output<string>();
  readonly dayChange = output<string>();
  readonly accountIdChange = output<string>();
  readonly accountTypeChange = output<string>();
  readonly globalCategoryChange = output<string>();
}
