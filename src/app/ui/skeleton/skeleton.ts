import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'fin-skeleton',
  standalone: true,
  imports: [HlmSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
})
export class SkeletonComponent {
  readonly i18n = inject(I18nService);
}
