import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'fin-search-field',
  imports: [FormsModule, HlmInputGroupImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmInputGroup>
      <div hlmInputGroupAddon><fin-icon name="search" /></div>
      <input
        hlmInputGroupInput
        type="text"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || placeholder()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
      />
      @if (value()) {
        <div hlmInputGroupAddon align="inline-end">
          <button
            hlmInputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            [attr.aria-label]="clearLabel()"
            (click)="value.set('')"
          >
            <fin-icon name="close" />
          </button>
        </div>
      }
    </div>
  `,
})
export class SearchFieldComponent {
  readonly i18n = inject(I18nService);
  readonly value = model('');
  readonly placeholder = input('');
  readonly ariaLabel = input('');
  readonly clearLabel = input(this.i18n.t('accounts.filters.search.clear'));
}
