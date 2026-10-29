import { Component, inject, computed } from '@angular/core';
import { DataTableComponent, FinTableCellDirective } from '@ui/data-table';
import { KpiComponent } from '@ui/kpi';
import { KpiGridComponent } from '@ui/kpi-grid';
import { TableZoneComponent } from '@ui/table-zone';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { AppStore } from '@core/state';
import { formatReturnRate } from '@core/utils';
import { I18nService } from '@core/i18n';
import { compactMoney } from '@shared/utils';
import { ChartCardComponent, ChartThemeService, anillo, barrasHorizontales } from '@ui/chart';
import { filaDeInversion } from './fila-de-inversion';
import { resumenCartera } from './resumen-cartera';

@Component({
  selector: 'app-portfolio-tab',
  imports: [
    ChartCardComponent,
    DataTableComponent,
    FinTableCellDirective,
    KpiComponent,
    KpiGridComponent,
    TableZoneComponent,
  ],
  templateUrl: './portfolio-tab.html',
  host: { class: `${TAB_PAGE_HOST_CLASS} overflow-y-auto` },
})
export class PortfolioTabComponent {
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);

  readonly investmentColumns = computed(() => [
    { key: 'name', label: this.i18n.t('portfolio.column.name') },
    { key: 'type', label: this.i18n.t('portfolio.column.type'), facet: true },
    { key: 'institution', label: this.i18n.t('portfolio.column.institution'), facet: true },
    { key: 'risk', label: this.i18n.t('portfolio.column.risk'), facet: true },
    { key: 'cost', label: this.i18n.t('portfolio.column.cost') },
    { key: 'value', label: this.i18n.t('portfolio.column.value') },
    { key: 'return', label: this.i18n.t('portfolio.column.return') },
  ]);
  readonly investmentRows = computed(() =>
    this.store.data().investments.map((i) => filaDeInversion(i, (valor, moneda) => this.store.money(valor, moneda))),
  );
  readonly resumen = computed(() => resumenCartera(this.store.data().investments, this.store.baseCurrency()));
  readonly investmentValue = computed(() => this.resumen().valor);
  readonly investmentGain = computed(() => this.resumen().ganancia);
  readonly gainTone = computed(() => (this.investmentGain() < 0 ? ('danger' as const) : ('success' as const)));
  readonly gainIcon = computed(() => (this.investmentGain() < 0 ? ('trendDown' as const) : ('trendUp' as const)));
  readonly valueHint = computed(() => {
    const base = this.i18n.t('portfolio.kpi.investments.hint');
    const otras = this.resumen().otrasMonedas;
    if (otras.length === 0) return base;
    const fuera = otras.map((o) => this.store.money(o.valor, o.moneda)).join(' · ');
    return `${base} · ${this.i18n.t('portfolio.kpi.investments.otherCurrencies', { value: fuera })}`;
  });
  private readonly temaGrafica = inject(ChartThemeService);
  private readonly dinero = (valor: number) => this.store.money(valor);
  private readonly compacto = (valor: number) => compactMoney(valor, this.store.preferences().locale);
  readonly hasInvestments = computed(() => this.store.data().investments.some((i) => i.value > 0 || i.cost > 0));
  readonly distributionOption = computed(() => {
    const porTipo = new Map<string, number>();
    for (const inversion of this.store.data().investments.filter((i) => i.currency === this.store.baseCurrency()))
      porTipo.set(inversion.type, (porTipo.get(inversion.type) ?? 0) + inversion.value);
    return anillo(
      this.temaGrafica.palette(),
      [...porTipo.entries()].map(([nombre, valor]) => ({ nombre, valor })),
      this.dinero,
      { valor: this.compacto(this.investmentValue()), etiqueta: this.i18n.t('portfolio.chart.total') },
    );
  });
  readonly costValueOption = computed(() => {
    const palette = this.temaGrafica.palette();
    const cartera = [...this.store.data().investments].sort((a, b) => b.value - a.value).slice(0, 8);
    return barrasHorizontales(
      palette,
      cartera.map((i) => i.name),
      [
        { nombre: this.i18n.t('portfolio.column.cost'), valores: cartera.map((i) => i.cost), color: palette.muted },
        { nombre: this.i18n.t('portfolio.column.value'), valores: cartera.map((i) => i.value), color: palette.accent },
      ],
      this.dinero,
      this.compacto,
    );
  });
  readonly investmentReturn = computed(() => formatReturnRate(this.resumen().valor, this.resumen().costo));
}
