import { HlmButton } from '@spartan-ng/helm/button';
import { CategoryBadgeComponent } from '../../../../ui/category-badge/category-badge';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { AppStore } from '../../../../core/state/store';

export interface CategoryListItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

/** Lista de categorías de gasto, cada una con su barra de reparto — clic filtra el resto del panel por esa categoría. */
@Component({
  imports: [NgScrollbar, HlmScrollAreaImports, HlmButton, CategoryBadgeComponent],
  selector: 'fin-category-list',
  host: { class: 'flex min-h-0 flex-1' },
  templateUrl: './category-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent {
  private readonly store = inject(AppStore);
  readonly items = input<readonly CategoryListItem[]>([]);
  readonly selected = input('all');
  readonly emptyText = input('');
  readonly ariaLabel = input('');
  @Output() readonly pick = new EventEmitter<string>();

  money(value: number): string {
    return this.store.money(value);
  }
}
