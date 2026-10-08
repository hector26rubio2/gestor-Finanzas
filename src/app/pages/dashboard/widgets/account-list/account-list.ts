import { HlmButton } from '@spartan-ng/helm/button';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { Component, inject, input, output } from '@angular/core';
import { AppStore } from '@core/state';

export interface AccountListItem {
  id: string;
  name: string;
  typeLabel: string;
  amount: number;
  currency: string;
  color?: string;
}

@Component({
  imports: [NgScrollbar, HlmScrollAreaImports, HlmButton],
  selector: 'fin-account-list',
  host: { class: 'flex min-h-0 flex-1' },
  templateUrl: './account-list.html',
})
export class AccountListComponent {
  private readonly store = inject(AppStore);
  readonly items = input<readonly AccountListItem[]>([]);
  readonly selected = input('all');
  readonly emptyText = input('');
  readonly pick = output<string>();

  money(value: number, currency: string): string {
    return this.store.money(value, currency);
  }
}
