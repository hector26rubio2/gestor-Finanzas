import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'fin-skeleton',
  imports: [HlmSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-lg bg-card p-6' },
  template: `
    <span role="status" class="sr-only">{{ i18n.t('skeleton.loading') }}</span>
    <div hlmSkeleton class="mb-4 h-5 w-2/5"></div>
    <div hlmSkeleton class="mb-4 h-8"></div>
    <div hlmSkeleton class="mb-4 h-8"></div>
    <div hlmSkeleton class="mb-4 h-8"></div>
  `,
})
export class SkeletonComponent {
  readonly i18n = inject(I18nService);
}
