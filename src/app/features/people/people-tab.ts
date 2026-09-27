import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { KpiGridComponent } from '../../ui/kpi-grid/kpi-grid';
import { TableZoneComponent } from '../../ui/table-zone/table-zone';
import { TAB_PAGE_HOST_CLASS } from '../../shared/tab-page-layout';
import { P } from '../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../core/state/store';
import { I18nService } from '../../core/i18n';
import { sumBy } from '../../core/utils/money';
import { SIN_DATO } from '../../shared/utils/placeholders';
import { ChartCardComponent } from '../../ui/chart/chart-card';
import { ChartThemeService } from '../../ui/chart/chart-theme';
import { compactMoney } from '../../shared/utils/chart-math';
import { barrasHorizontales } from '../../ui/chart/opciones';

@Component({
  selector: 'app-people-tab',
  imports: [ChartCardComponent, DataTableComponent, KpiComponent, KpiGridComponent, TableZoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people-tab.html',
  host: { class: `${TAB_PAGE_HOST_CLASS} overflow-y-auto` },
})
export class PeopleTabComponent {
  readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly peopleColumns = computed(() => [
    { key: 'name', label: this.i18n.t('people.column.name') },
    { key: 'kind', label: this.i18n.t('people.column.kind'), facet: true },
    { key: 'relationship', label: this.i18n.t('people.column.relationship'), facet: true },
    { key: 'owed', label: this.i18n.t('people.column.owed') },
    { key: 'owing', label: this.i18n.t('people.column.owing') },
    { key: 'balance', label: this.i18n.t('people.column.balance') },
    { key: 'payment', label: this.i18n.t('people.column.payment') },
  ]);
  readonly peopleRows = computed(() =>
    this.store.data().people.map((p) => ({
      id: p.id,
      name: p.name,
      kind: this.i18n.t(p.kind === 'institution' ? 'people.kind.institution' : 'people.kind.person'),
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
  private readonly temaGrafica = inject(ChartThemeService);
  private readonly conSaldo = computed(() =>
    [...this.store.data().people]
      .filter((p) => p.owed > 0 || p.owing > 0)
      .sort((a, b) => b.owed + b.owing - (a.owed + a.owing))
      .slice(0, 8),
  );
  readonly hasBalances = computed(() => this.conSaldo().length > 0);
  readonly balancesOption = computed(() => {
    const palette = this.temaGrafica.palette();
    const personas = this.conSaldo();
    return barrasHorizontales(
      palette,
      personas.map((p) => p.name),
      [
        { nombre: this.i18n.t('people.column.owed'), valores: personas.map((p) => p.owed), color: palette.success },
        { nombre: this.i18n.t('people.column.owing'), valores: personas.map((p) => p.owing), color: palette.danger },
      ],
      (valor) => this.store.money(valor),
      (valor) => compactMoney(valor, this.store.preferences().locale),
    );
  });
  readonly peopleOwed = computed(() => sumBy(this.store.data().people, (p) => p.owed));
  readonly peopleOwing = computed(() => sumBy(this.store.data().people, (p) => p.owing));
  readonly slowestPayer = computed(() => {
    const conDatos = this.store.data().people.filter((p) => p.averagePaymentDays != null);
    const person = [...conDatos].sort((a, b) => (b.averagePaymentDays ?? 0) - (a.averagePaymentDays ?? 0))[0];
    return {
      name: person?.name ?? this.i18n.t('people.noData'),
      days: person?.averagePaymentDays ?? 0,
      hintKey: `people.kpi.slowest.hint.${this.store.runtime.mode}`,
    };
  });
}
