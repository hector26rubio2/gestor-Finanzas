import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon';

@Component({
  selector: 'fin-empty',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  readonly i18n = inject(I18nService);
  readonly title = input(this.i18n.t('emptyState.defaultTitle'));
  readonly detail = input(this.i18n.t('emptyState.defaultDetail'));
}
