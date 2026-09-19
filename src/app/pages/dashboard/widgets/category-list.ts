import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { AppStore } from '../../../core/store';

export interface CategoryListItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

/** Lista de categorías de gasto, cada una con su barra de reparto — clic filtra el resto del panel por esa categoría. */
@Component({
  selector: 'fin-category-list',
  standalone: true,
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
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
