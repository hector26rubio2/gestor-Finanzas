import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { KpiComponent } from '../../ui/kpi/kpi';
import { KpiGridComponent } from '../../ui/kpi-grid/kpi-grid';
import { TableZoneComponent } from '../../ui/table-zone/table-zone';
import { TAB_PAGE_HOST_CLASS } from '../../shared/tab-page-layout';
import { AppStore } from '../../core/state/store';
import { formatReturnRate } from '../../core/utils/money';
import { I18nService } from '../../core/i18n';
import { SIN_DATO } from '../../shared/utils/placeholders';

@Component({
  selector: 'app-portfolio-tab',
  imports: [DataTableComponent, KpiComponent, KpiGridComponent, TableZoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
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
  readonly investmentValue = computed(() => this.store.data().investments.reduce((s, i) => s + i.value, 0));
  readonly investmentGain = computed(() => this.store.data().investments.reduce((s, i) => s + i.value - i.cost, 0));
  readonly investmentReturn = computed(() => {
    const cartera = this.store.data().investments;
    return formatReturnRate(
      cartera.reduce((total, i) => total + i.value, 0),
      cartera.reduce((total, i) => total + i.cost, 0),
    );
  });
}
