import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { HlmButton } from '@spartan-ng/helm/button';
import { KpiGridComponent } from '../../ui/kpi-grid/kpi-grid';
import { SearchFieldComponent } from '../../ui/search-field/search-field';
import { TableZoneComponent } from '../../ui/table-zone/table-zone';
import { TAB_PAGE_HOST_CLASS } from '../../shared/tab-page-layout';
import { UiSelectComponent } from '../../ui/select/select';
import { AppStore } from '../../core/state/store';
import { I18nService } from '../../core/i18n';
import { MovementsBookService } from '../../shared/movements/movements-book.service';
import { Account } from '../../core/state/demo-data';
import { todayIso } from '../../core/utils/dates';
import {
  HEALTHY_UTILIZATION_PERCENT,
  creditCards,
  mostOverextendedCard,
  mostUsedCard,
  nextCardDue,
} from './card-insights';

@Component({
  selector: 'app-accounts-tab',
  imports: [
    FormsModule,
    HlmButton,
    DataTableComponent,
    KpiComponent,
    KpiGridComponent,
    SearchFieldComponent,
    TableZoneComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accounts-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
})
export class AccountsTabComponent {
  readonly Math = Math;
  readonly store = inject(AppStore);
  readonly book = inject(MovementsBookService);
  readonly i18n = inject(I18nService);

  private readonly referenceDate = computed(() => (this.store.runtime.mode === 'demo' ? '2026-08-31' : todayIso()));
  private readonly cards = computed(() => creditCards(this.store.data().accounts));
  private readonly debtOf = (card: Account) => Math.max(0, -this.store.balance(card));
  readonly nextDue = computed(() => nextCardDue(this.cards(), this.debtOf, this.referenceDate()));
  readonly mostUsed = computed(() => mostUsedCard(this.cards(), this.store.data().movements, this.referenceDate()));
  readonly mostOverextended = computed(() => mostOverextendedCard(this.cards(), this.debtOf));
  readonly healthyPercent = HEALTHY_UTILIZATION_PERCENT;

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
