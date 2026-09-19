import { HlmButton } from '@spartan-ng/helm/button';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { AppStore } from '../../../../core/state/store';

export interface AccountListItem {
  id: string;
  name: string;
  typeLabel: string;
  amount: number;
  currency: string;
  color?: string;
}

/** Lista de cuentas por gasto, cada una con su color — clic filtra el resto del panel por esa cuenta. */
@Component({
  imports: [HlmButton],
  selector: 'fin-account-list',
  host: { class: 'flex min-h-0 flex-1' },
  templateUrl: './account-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountListComponent {
  private readonly store = inject(AppStore);
  readonly items = input<readonly AccountListItem[]>([]);
  readonly selected = input('all');
  readonly emptyText = input('');
  @Output() readonly pick = new EventEmitter<string>();

  money(value: number, currency: string): string {
    return this.store.money(value, currency);
  }
}
