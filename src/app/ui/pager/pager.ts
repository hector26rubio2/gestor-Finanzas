import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { HlmPaginationImports } from '@spartan-ng/helm/pagination';
import { I18nService } from '../../core/i18n';

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
  imports: [HlmPaginationImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground' },
  template: `
    <span>{{ summary() }}</span>
    @if (pages() > 1) {
      <nav hlmPagination class="mx-0 w-auto" [attr.aria-label]="i18n.t('pager.ariaLabel')">
        <ul hlmPaginationContent>
          <li hlmPaginationItem>
            <hlm-pagination-previous
              [text]="i18n.t('admin.roles.pager.previous')"
              [aria-label]="i18n.t('admin.roles.pager.previous')"
              [attr.aria-disabled]="page() <= 1"
              [class.pointer-events-none]="page() <= 1"
              [class.opacity-50]="page() <= 1"
              (click)="ir(page() - 1)"
            />
          </li>
          @for (item of visibles(); track $index) {
            <li hlmPaginationItem>
              @if (item === 'hueco') {
                <hlm-pagination-ellipsis />
              } @else {
                <a hlmPaginationLink [isActive]="item === page()" (click)="ir(item)">{{ item }}</a>
              }
            </li>
          }
          <li hlmPaginationItem>
            <hlm-pagination-next
              [text]="i18n.t('admin.roles.pager.next')"
              [aria-label]="i18n.t('admin.roles.pager.next')"
              [attr.aria-disabled]="page() >= pages()"
              [class.pointer-events-none]="page() >= pages()"
              [class.opacity-50]="page() >= pages()"
              (click)="ir(page() + 1)"
            />
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
