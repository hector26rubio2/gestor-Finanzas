import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { IconComponent } from '../../ui/icon';
import { UiSelectComponent } from '../../ui/select';
import { DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';
import { MovementsBookService } from '../../shared/movements/movements-book.service';

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
  readonly i18n = inject(I18nService);

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
  }
  setAccountType(value: 'all' | 'savings' | 'credit' | 'cash'): void {
    this.accountType.set(value);
  }
  /** Cambia cual cuenta filtra la tabla de abajo, sin abrir su inspector. */
  filterByAccount(id: string): void {
    this.selectedAccountFilter.set(id);
  }
  /** Abre el inspector completo: extracto, historial y acciones (pago, editar, desactivar). */
  selectAccount(id: string, type: string): void {
    this.selectedAccountFilter.set(id);
    this.store.cardPaymentMode.set(false);
    this.store.inspect(type === 'credit' ? 'card' : 'account', id);
  }
}
