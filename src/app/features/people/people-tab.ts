import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent, KpiComponent } from '../../ui/ui';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';
import { SIN_DATO } from '../../shared/utils/placeholders';

@Component({
  selector: 'app-people-tab',
  standalone: true,
  imports: [DataTableComponent, KpiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people-tab.html',
  styleUrl: '../../pages/workspace.css',
})
export class PeopleTabComponent {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly peopleColumns = computed(() => [
    { key: 'name', label: this.i18n.t('people.column.name') },
    { key: 'relationship', label: this.i18n.t('people.column.relationship') },
    { key: 'owed', label: this.i18n.t('people.column.owed') },
    { key: 'owing', label: this.i18n.t('people.column.owing') },
    { key: 'balance', label: this.i18n.t('people.column.balance') },
    { key: 'payment', label: this.i18n.t('people.column.payment') },
  ]);
  readonly peopleRows = computed(() =>
    this.store.data().people.map((p) => ({
      id: p.id,
      name: p.name,
      relationship: p.relationship ?? SIN_DATO,
      owed: this.store.money(p.owed),
      owing: this.store.money(p.owing),
      balance: this.store.money(p.owed - p.owing),
      payment:
        p.averagePaymentDays == null
          ? this.i18n.t('people.payment.none')
          : this.i18n.t('people.payment.summary', {
              days: p.averagePaymentDays,
              late: p.latePayments ?? 0,
            }),
    })),
  );
  readonly peopleOwed = computed(() => this.store.data().people.reduce((s, p) => s + p.owed, 0));
  readonly peopleOwing = computed(() => this.store.data().people.reduce((s, p) => s + p.owing, 0));
  readonly slowestPayer = computed(() => {
    const person = [...this.store.data().people].sort(
      (a, b) => (b.averagePaymentDays ?? 0) - (a.averagePaymentDays ?? 0),
    )[0];
    return { name: person?.name ?? this.i18n.t('people.noData'), days: person?.averagePaymentDays ?? 0 };
  });
}
