import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent, KpiComponent } from '../../ui/ui';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
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
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly peopleColumns = [
    { key: 'name', label: 'Persona' },
    { key: 'relationship', label: 'Relación' },
    { key: 'owed', label: 'Me debe' },
    { key: 'owing', label: 'Le debo' },
    { key: 'balance', label: 'Saldo' },
    { key: 'payment', label: 'Comportamiento de pago' },
  ];
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
          ? 'Sin historial'
          : `${p.averagePaymentDays} días prom. · ${p.latePayments ?? 0} tardíos`,
    })),
  );
  readonly peopleOwed = computed(() => this.store.data().people.reduce((s, p) => s + p.owed, 0));
  readonly peopleOwing = computed(() => this.store.data().people.reduce((s, p) => s + p.owing, 0));
  readonly slowestPayer = computed(() => {
    const person = [...this.store.data().people].sort(
      (a, b) => (b.averagePaymentDays ?? 0) - (a.averagePaymentDays ?? 0),
    )[0];
    return { name: person?.name ?? 'Sin datos', days: person?.averagePaymentDays ?? 0 };
  });
}
