import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'fin-option-row',
  imports: [HlmSwitch, HlmCheckbox, HlmBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent/60' },
  template: `
    <span class="flex min-w-0 flex-col gap-0.5">
      <span class="flex items-center gap-2 text-sm font-medium">
        {{ label() }}
        @if (changed()) {
          <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
        }
      </span>
      @if (description()) {
        <small class="truncate text-xs text-muted-foreground">{{ description() }}</small>
      }
    </span>
    @if (kind() === 'switch') {
      <hlm-switch
        [checked]="checked()"
        [disabled]="disabled()"
        [aria-label]="label()"
        (checkedChange)="toggled.emit($event)"
      />
    } @else {
      <hlm-checkbox
        [checked]="checked()"
        [disabled]="disabled()"
        [aria-label]="label()"
        (checkedChange)="toggled.emit($event)"
      />
    }
  `,
})
export class OptionRowComponent {
  readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  readonly description = input('');
  readonly checked = input.required<boolean>();
  readonly disabled = input(false);
  readonly changed = input(false);
  readonly kind = input<'switch' | 'checkbox'>('switch');
  readonly toggled = output<boolean>();
}
