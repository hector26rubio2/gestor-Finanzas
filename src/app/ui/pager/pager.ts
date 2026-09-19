import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'fin-pager',
  imports: [HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between gap-3 text-sm text-muted-foreground' },
  template: `
    <span>{{ summary() }}</span>
    @if (pages() > 1) {
      <span class="flex items-center gap-2">
        <button hlmBtn variant="outline" size="sm" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
          {{ i18n.t('admin.roles.pager.previous') }}
        </button>
        <span>{{ i18n.t('admin.roles.pager.pageOfTotal', { page: page(), total: pages() }) }}</span>
        <button hlmBtn variant="outline" size="sm" [disabled]="page() >= pages()" (click)="pageChange.emit(page() + 1)">
          {{ i18n.t('admin.roles.pager.next') }}
        </button>
      </span>
    }
  `,
})
export class PagerComponent {
  readonly i18n = inject(I18nService);
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly total = input.required<number>();
  readonly summary = input('');
  readonly pageChange = output<number>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
}
