import { Component, inject, computed } from '@angular/core';
import { DataTableComponent } from '@ui/data-table';
import { KpiComponent } from '@ui/kpi';
import { KpiGridComponent } from '@ui/kpi-grid';
import { TableZoneComponent } from '@ui/table-zone';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { formatNumber, sumBy } from '@core/utils';
import { SIN_DATO, compactMoney } from '@shared/utils';
import { PeopleStore } from './people.store';
import { Comportamiento, comportamientoDePago, masAtrasado } from './deudas';
import { ChartCardComponent, ChartThemeService, barrasHorizontales } from '@ui/chart';

@Component({
  selector: 'app-people-tab',
  imports: [ChartCardComponent, DataTableComponent, KpiComponent, KpiGridComponent, TableZoneComponent],
  templateUrl: './people-tab.html',
  host: { class: `${TAB_PAGE_HOST_CLASS} overflow-y-auto` },
})
export class PeopleTabComponent {
  readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  private readonly people = inject(PeopleStore);

  constructor() {
    this.people.solicitar();
  }

  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly peopleColumns = computed(() => [
    { key: 'name', label: this.i18n.t('people.column.name') },
    { key: 'kind', label: this.i18n.t('people.column.kind'), facet: true },
    { key: 'relationship', label: this.i18n.t('people.column.relationship'), facet: true },
    { key: 'currency', label: this.i18n.t('people.column.currency') },
    { key: 'owed', label: this.i18n.t('people.column.owed') },
    { key: 'owing', label: this.i18n.t('people.column.owing') },
    { key: 'balance', label: this.i18n.t('people.column.balance') },
    { key: 'payment', label: this.i18n.t('people.column.payment') },
  ]);
  readonly peopleRows = computed(() =>
    this.people.personas().map((p) => ({
      id: p.id,
      name: p.name,
      kind: this.i18n.t(p.kind === 'institution' ? 'people.kind.institution' : 'people.kind.person'),
      relationship: p.relationship ?? SIN_DATO,
      currency: this.store.baseCurrency(),
      owed: this.numero(p.owed),
      owing: this.numero(p.owing),
      balance: this.numero(p.owed - p.owing),
      payment: this.textoDeComportamiento(
        comportamientoDePago(this.people.deudas().filter((deuda) => deuda.personaId === p.id)),
      ),
    })),
  );
  readonly hayDeudas = computed(() => this.people.deudas().length > 0);
  readonly debtColumns = computed(() => [
    { key: 'person', label: this.i18n.t('people.column.name') },
    { key: 'direction', label: this.i18n.t('people.debts.column.direction'), facet: true },
    { key: 'description', label: this.i18n.t('people.debts.column.description') },
    { key: 'currency', label: this.i18n.t('people.column.currency') },
    { key: 'value', label: this.i18n.t('people.debts.column.value') },
    { key: 'installment', label: this.i18n.t('people.debts.column.installment') },
    { key: 'installmentNumber', label: this.i18n.t('people.debts.column.installmentNumber') },
    { key: 'pending', label: this.i18n.t('people.debts.column.pending') },
    { key: 'status', label: this.i18n.t('people.column.payment'), facet: true },
  ]);
  readonly debtRows = computed(() =>
    this.people.deudas().map((d) => ({
      id: d.id,
      personId: d.personaId,
      person: d.persona,
      direction: this.i18n.t(d.direccion === 'owed' ? 'people.column.owed' : 'people.column.owing'),
      description: d.tarjeta
        ? `${d.descripcion ?? ''} · ${d.tarjeta}`.replace(/^ · /, '')
        : (d.descripcion ?? SIN_DATO),
      currency: d.moneda,
      value: formatNumber(d.valor, d.moneda, this.store.preferences().locale),
      installment: d.cuota === null ? SIN_DATO : formatNumber(d.cuota, d.moneda, this.store.preferences().locale),
      installmentNumber:
        d.totalCuotas === null
          ? SIN_DATO
          : this.i18n.t('people.debts.installmentOf', { current: d.cuotaActual ?? 1, total: d.totalCuotas }),
      pending: formatNumber(d.pendiente, d.moneda, this.store.preferences().locale),
      status: d.saldada ? this.i18n.t('people.payment.paid') : this.textoDeComportamiento(comportamientoDePago([d])),
    })),
  );
  private numero(valor: number): string {
    return formatNumber(valor, this.store.baseCurrency(), this.store.preferences().locale);
  }
  private textoDeComportamiento(comportamiento: Comportamiento): string {
    return this.i18n.t(`people.payment.${comportamiento.estado}`, { count: comportamiento.atrasadas });
  }
  private readonly temaGrafica = inject(ChartThemeService);
  private readonly conSaldo = computed(() =>
    [...this.people.personas()]
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
  readonly peopleOwed = computed(() => sumBy(this.people.personas(), (p) => p.owed));
  readonly peopleOwing = computed(() => sumBy(this.people.personas(), (p) => p.owing));
  readonly slowestPayer = computed(() => {
    const peor = masAtrasado(this.people.deudas());
    return peor
      ? { name: peor.persona, days: peor.atrasadas, hintKey: 'people.kpi.slowest.hint.installments' }
      : { name: this.i18n.t('people.kpi.slowest.none'), days: 0, hintKey: 'people.kpi.slowest.hint.upToDate' };
  });
}
