import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { I18nService } from '../core/i18n';
import { IconComponent } from './icon';

export interface UiOption {
  value: string;
  label: string;
  description?: string;
}

@Component({
  selector: 'demo-select',
  standalone: true,
  imports: [IconComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class UiSelectComponent implements ControlValueAccessor {
  readonly i18n = inject(I18nService);
  readonly options = input.required<readonly UiOption[]>();
  readonly ariaLabel = input(this.i18n.t('select.defaultAriaLabel'));
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly open = signal(false);
  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = () => this.disabledInput() || this.cvaDisabled();
  private readonly host = inject(ElementRef<HTMLElement>);
  private change: (value: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  selectedLabel(): string {
    return this.options().find((option) => option.value === this.value())?.label ?? this.i18n.t('select.placeholder');
  }
  choose(value: string): void {
    this.value.set(value);
    this.change(value);
    this.touched();
    this.open.set(false);
  }
  key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const options = this.options();
    const current = Math.max(
      0,
      options.findIndex((option) => option.value === this.value()),
    );
    const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, current + 1) : Math.max(0, current - 1);
    if (options[next]) this.choose(options[next].value);
  }
  @HostListener('document:pointerdown', ['$event'])
  outside(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
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
