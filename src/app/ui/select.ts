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
  template: `
    <button
      type="button"
      class="trigger"
      [disabled]="isDisabled()"
      [attr.aria-label]="ariaLabel()"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      (click)="open.update((value) => !value)"
      (keydown)="key($event)"
    >
      <span>{{ selectedLabel() }}</span
      ><demo-icon name="chevronDown" />
    </button>
    @if (open()) {
      <div class="menu" role="listbox" [attr.aria-label]="ariaLabel()">
        @for (option of options(); track option.value) {
          <button
            type="button"
            role="option"
            [class.selected]="option.value === value()"
            [attr.aria-selected]="option.value === value()"
            (click)="choose(option.value)"
          >
            <span
              ><b>{{ option.label }}</b>
              @if (option.description) {
                <small>{{ option.description }}</small>
              }
            </span>
            @if (option.value === value()) {
              <span class="check">✓</span>
            }
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        min-width: 0;
      }
      .trigger {
        width: 100%;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 10px 7px 12px;
        text-align: left;
        background: linear-gradient(180deg, var(--surface), color-mix(in srgb, var(--panel) 58%, var(--surface)));
        border: 1px solid var(--control-line);
        box-shadow:
          0 1px 2px color-mix(in srgb, var(--text) 6%, transparent),
          inset 0 1px #fff2;
      }
      .trigger span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .trigger demo-icon {
        --icon-size: 15px;
        color: var(--muted);
        transition: transform 0.16s ease;
      }
      .trigger[aria-expanded='true'] {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
      }
      .trigger[aria-expanded='true'] demo-icon {
        transform: rotate(180deg);
      }
      .menu {
        position: absolute;
        z-index: 100;
        top: calc(100% + 6px);
        left: 0;
        min-width: 100%;
        width: max-content;
        max-width: min(360px, calc(100vw - 32px));
        max-height: min(320px, 50vh);
        overflow: auto;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 18px 45px #001c1730;
        scrollbar-width: thin;
        scrollbar-color: var(--line) transparent;
      }
      .menu button {
        width: 100%;
        border: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        text-align: left;
        padding: 9px 10px;
        min-height: 38px;
        font-weight: 500;
      }
      .menu button:hover,
      .menu button.selected {
        background: var(--accent-soft);
        color: var(--text);
      }
      .menu button > span:first-child {
        display: grid;
        gap: 2px;
      }
      small {
        color: var(--muted);
        font-size: 11px;
      }
      .check {
        color: var(--accent);
        font-weight: 800;
      }
    `,
  ],
})
export class UiSelectComponent implements ControlValueAccessor {
  readonly options = input.required<readonly UiOption[]>();
  readonly ariaLabel = input('Seleccionar opción');
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly open = signal(false);
  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = () => this.disabledInput() || this.cvaDisabled();
  private readonly host = inject(ElementRef<HTMLElement>);
  private change: (value: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  selectedLabel(): string {
    return this.options().find((option) => option.value === this.value())?.label ?? 'Seleccionar';
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
