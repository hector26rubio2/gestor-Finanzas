import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { I18nService } from '../../core/i18n';
import { AppStore } from '../../core/state/store';
import { CalendarLocale } from './calendar-locale';

const NOON = 12;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(value: string): Date | undefined {
  return value ? new Date(`${value}T${String(NOON).padStart(2, '0')}:00:00`) : undefined;
}

@Component({
  selector: 'fin-date-field',
  imports: [HlmDatePickerImports],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateFieldComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <hlm-date-picker
      captionLayout="dropdown"
      [date]="date()"
      [formatDate]="format()"
      [transformDate]="atNoon"
      [autoCloseOnSelect]="true"
      [disabled]="isDisabled()"
      (dateChange)="pick($event)"
    >
      <hlm-date-picker-trigger class="w-full" variant="outline">{{
        placeholder() || i18n.t('date.placeholder')
      }}</hlm-date-picker-trigger>
    </hlm-date-picker>
  `,
})
export class DateFieldComponent implements ControlValueAccessor {
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly calendarLocale = inject(CalendarLocale);
  readonly placeholder = input('');
  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());
  readonly date = computed(() => fromIsoDate(this.value()));
  readonly format = computed(() => {
    const formatter = new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'medium' });
    return (date: Date) => formatter.format(date);
  });
  readonly atNoon = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), NOON);
  private change: (value: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  pick(date: Date | null): void {
    const next = date ? toIsoDate(date) : '';
    this.value.set(next);
    this.change(next);
    this.touched();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.change = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
  }
}
