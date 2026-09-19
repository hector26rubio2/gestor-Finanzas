import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon';

@Component({
  selector: 'fin-empty',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-[180px] flex-col items-center justify-center p-6 text-center text-foreground' },
  template: `
    <fin-icon name="dashboard" class="text-3xl text-primary" />
    <h3 class="mb-2 mt-3 text-base font-semibold">{{ title() }}</h3>
    <p class="mb-4 max-w-[420px] text-sm leading-relaxed text-muted-foreground">{{ detail() }}</p>
    <ng-content />
  `,
})
export class EmptyStateComponent {
  readonly i18n = inject(I18nService);
  readonly title = input(this.i18n.t('emptyState.defaultTitle'));
  readonly detail = input(this.i18n.t('emptyState.defaultDetail'));
}
