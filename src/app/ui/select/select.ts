import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { I18nService } from '../../core/i18n';

const EMPTY_VALUE = '__fin_empty__';
const encode = (value: string): string => (value === '' ? EMPTY_VALUE : value);
const decode = (value: string | null | undefined): string => (value === EMPTY_VALUE ? '' : (value ?? ''));

export interface UiOption {
  value: string;
  label: string;
  description?: string;
}

@Component({
  selector: 'fin-select',
  imports: [HlmSelectImports],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <hlm-select [value]="bound()" [disabled]="isDisabled()" [itemToString]="labelOf" (valueChange)="choose($event)">
      <hlm-select-trigger class="w-full">
        <hlm-select-value [placeholder]="i18n.t('select.placeholder')" />
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal>
        @for (option of options(); track option.value) {
          <hlm-select-item [value]="encode(option.value)">
            <span class="flex flex-col">
              <span>{{ option.label }}</span>
              @if (option.description) {
                <small class="text-xs text-muted-foreground">{{ option.description }}</small>
              }
            </span>
          </hlm-select-item>
        }
      </hlm-select-content>
    </hlm-select>
  `,
})
export class UiSelectComponent implements ControlValueAccessor {
  readonly i18n = inject(I18nService);
  readonly options = input.required<readonly UiOption[]>();
  readonly ariaLabel = input(this.i18n.t('select.defaultAriaLabel'));
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = () => this.disabledInput() || this.cvaDisabled();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private change: (value: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  readonly bound = computed(() =>
    this.options().some((option) => option.value === this.value()) ? encode(this.value()) : null,
  );
  readonly encode = encode;
  readonly labelOf = (value: string | null | undefined): string =>
    this.options().find((option) => encode(option.value) === value)?.label ?? '';

  constructor() {
    effect(() => {
      const accessibleName = `${this.ariaLabel()}: ${this.selectedLabel()}`;
      const trigger = this.host.nativeElement.querySelector('[data-slot="select-trigger"]');
      trigger?.setAttribute('aria-label', accessibleName);
    });
  }

  selectedLabel(): string {
    return this.options().find((option) => option.value === this.value())?.label ?? this.i18n.t('select.placeholder');
  }

  choose(value: string | null | undefined): void {
    const next = decode(value);
    if (next === this.value()) return;
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
