import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { KpiGridComponent } from '../../ui/kpi-grid/kpi-grid';
import { TableZoneComponent } from '../../ui/table-zone/table-zone';
import { TAB_PAGE_HOST_CLASS } from '../../shared/tab-page-layout';
import { AppStore } from '../../core/state/store';
import { formatReturnRate, sumBy } from '../../core/utils/money';
import { I18nService } from '../../core/i18n';
import { SIN_DATO } from '../../shared/utils/placeholders';
import { ChartCardComponent } from '../../ui/chart/chart-card';
import { ChartThemeService } from '../../ui/chart/chart-theme';
import { compactMoney } from '../../shared/utils/chart-math';
import { anillo, barrasHorizontales } from '../../ui/chart/opciones';

@Component({
  selector: 'app-portfolio-tab',
  imports: [ChartCardComponent, DataTableComponent, KpiComponent, KpiGridComponent, TableZoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    this.store.data().investments.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      institution: i.institution ?? SIN_DATO,
      risk: i.risk && i.liquidity ? `${i.risk} · ${i.liquidity}` : SIN_DATO,
      cost: this.store.money(i.cost),
      value: this.store.money(i.value),
      return: formatReturnRate(i.value, i.cost),
    })),
  );
  readonly investmentValue = computed(() => sumBy(this.store.data().investments, (i) => i.value));
  readonly investmentGain = computed(() => sumBy(this.store.data().investments, (i) => i.value - i.cost));
  private readonly temaGrafica = inject(ChartThemeService);
  private readonly dinero = (valor: number) => this.store.money(valor);
  private readonly compacto = (valor: number) => compactMoney(valor, this.store.preferences().locale);
  readonly hasInvestments = computed(() => this.store.data().investments.some((i) => i.value > 0 || i.cost > 0));
  readonly distributionOption = computed(() => {
    const porTipo = new Map<string, number>();
    for (const inversion of this.store.data().investments)
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
  readonly investmentReturn = computed(() => {
    const cartera = this.store.data().investments;
    return formatReturnRate(
      sumBy(cartera, (i) => i.value),
      sumBy(cartera, (i) => i.cost),
    );
  });
}
