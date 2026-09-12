import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, KpiComponent } from '../../ui/ui';
import { IconComponent } from '../../ui/icon';
import { UiSelectComponent } from '../../ui/select';
import { DemoStore } from '../../core/store';
import { MovementsBookService } from '../../shared/movements/movements-book.service';
import type { Account } from '../../core/demo-data';

@Component({
  selector: 'app-accounts-tab',
  standalone: true,
  imports: [FormsModule, DataTableComponent, KpiComponent, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accounts-tab.html',
  styleUrl: './accounts-tab.css',
})
export class AccountsTabComponent {
  readonly Math = Math;
  readonly store = inject(DemoStore);
  readonly book = inject(MovementsBookService);

  readonly compactCards = signal(false);
  readonly accountQuery = signal('');
  readonly accountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  readonly filteredAccounts = computed(() => {
    const query = this.accountQuery().trim().toLocaleLowerCase('es');
    const type = this.accountType();
    return this.store
      .data()
      .accounts.filter(
        (account) =>
          (type === 'all' || account.type === type) &&
          (!query ||
            account.name.toLocaleLowerCase('es').includes(query) ||
            (account.lastFour ?? '').toLocaleLowerCase('es').includes(query)),
      );
  });
  readonly accountPage = signal(0);
  readonly accountPageSize = 6;
  readonly accountPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredAccounts().length / this.accountPageSize)),
  );
  readonly visibleAccounts = computed(() =>
    this.filteredAccounts().slice(
      this.accountPage() * this.accountPageSize,
      (this.accountPage() + 1) * this.accountPageSize,
    ),
  );
  readonly selectedAccountFilter = signal('all');
  readonly accountMovementRows = computed(() =>
    this.book
      .movementRows()
      .filter(
        (row) => this.selectedAccountFilter() === 'all' || row['raw']?.accountId === this.selectedAccountFilter(),
      ),
  );

  setAccountQuery(value: string): void {
    this.accountQuery.set(value);
    this.accountPage.set(0);
  }
  setAccountType(value: 'all' | 'savings' | 'credit' | 'cash'): void {
    this.accountType.set(value);
    this.accountPage.set(0);
  }
  selectAccount(id: string, type: string): void {
    this.selectedAccountFilter.set(id);
    this.store.cardPaymentMode.set(false);
    this.store.inspect(type === 'credit' ? 'card' : 'account', id);
  }
  displayBalance(account: Account): number {
    const value = this.store.balance(account);
    return account.type === 'credit' ? (value < 0 ? -value : 0) : value;
  }
}
