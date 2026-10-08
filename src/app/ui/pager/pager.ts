import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { HlmPaginationImports } from '@spartan-ng/helm/pagination';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';

type Pagina = number | 'hueco';

const VECINAS = 1;

export function paginasVisibles(actual: number, total: number): Pagina[] {
  const paginas = new Set([1, total]);
  for (let p = actual - VECINAS; p <= actual + VECINAS; p++) if (p >= 1 && p <= total) paginas.add(p);
  const ordenadas = [...paginas].sort((a, b) => a - b);
  return ordenadas.flatMap((p, i) => (i > 0 && p - ordenadas[i - 1] > 1 ? (['hueco', p] as Pagina[]) : [p]));
}

@Component({
  selector: 'fin-pager',
  imports: [HlmPaginationImports, HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground' },
  template: `
    <span>{{ summary() }}</span>
    @if (pages() > 1) {
      <nav hlmPagination class="mx-0 w-auto" [attr.aria-label]="i18n.t('pager.ariaLabel')">
        <ul hlmPaginationContent>
          <li hlmPaginationItem>
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              type="button"
              [attr.aria-label]="i18n.t('admin.roles.pager.previous')"
              [disabled]="page() <= 1"
              (click)="ir(page() - 1)"
            >
              ‹
            </button>
          </li>
          @for (item of visibles(); track $index) {
            <li hlmPaginationItem>
              @if (item === 'hueco') {
                <hlm-pagination-ellipsis />
              } @else {
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  type="button"
                  [attr.aria-current]="item === page() ? 'page' : null"
                  (click)="ir(item)"
                >
                  {{ item }}
                </button>
              }
            </li>
          }
          <li hlmPaginationItem>
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              type="button"
              [attr.aria-label]="i18n.t('admin.roles.pager.next')"
              [disabled]="page() >= pages()"
              (click)="ir(page() + 1)"
            >
              ›
            </button>
          </li>
        </ul>
      </nav>
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
  readonly visibles = computed(() => paginasVisibles(this.page(), this.pages()));

  ir(pagina: number): void {
    if (pagina >= 1 && pagina <= this.pages() && pagina !== this.page()) this.pageChange.emit(pagina);
  }
}
