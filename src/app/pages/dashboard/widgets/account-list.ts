import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { DemoStore } from '../../../core/store';

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
  selector: 'fin-account-list',
  standalone: true,
  templateUrl: './account-list.html',
  styleUrl: './account-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountListComponent {
  private readonly store = inject(DemoStore);
  readonly items = input<readonly AccountListItem[]>([]);
  readonly selected = input('all');
  readonly emptyText = input('');
  @Output() readonly pick = new EventEmitter<string>();

  money(value: number, currency: string): string {
    return this.store.money(value, currency);
  }
}
