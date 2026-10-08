import { HlmButton } from '@spartan-ng/helm/button';
import { CategoryBadgeComponent } from '@ui/category-badge';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { Component, inject, input, output } from '@angular/core';
import { AppStore } from '@core/state';

export interface CategoryListItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

@Component({
  imports: [NgScrollbar, HlmScrollAreaImports, HlmButton, CategoryBadgeComponent],
  selector: 'fin-category-list',
  host: { class: 'flex min-h-0 flex-1' },
  templateUrl: './category-list.html',
})
export class CategoryListComponent {
  private readonly store = inject(AppStore);
  readonly items = input<readonly CategoryListItem[]>([]);
  readonly selected = input('all');
  readonly emptyText = input('');
  readonly ariaLabel = input('');
  readonly pick = output<string>();

  money(value: number): string {
    return this.store.money(value);
  }
}
