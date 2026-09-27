import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { I18nService } from '@core/i18n';
import { IconComponent, IconName } from '@ui/icon';

@Component({
  selector: 'fin-empty',
  imports: [HlmEmptyImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmEmpty class="min-h-[180px]">
      <div hlmEmptyHeader>
        <div hlmEmptyMedia variant="icon"><fin-icon [name]="icon()" /></div>
        <div hlmEmptyTitle>{{ title() }}</div>
        <p hlmEmptyDescription>{{ detail() }}</p>
      </div>
      <div hlmEmptyContent><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly i18n = inject(I18nService);
  readonly icon = input<IconName>('dashboard');
  readonly title = input(this.i18n.t('emptyState.defaultTitle'));
  readonly detail = input(this.i18n.t('emptyState.defaultDetail'));
}
