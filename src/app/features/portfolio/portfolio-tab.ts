import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { DataTableComponent, KpiComponent } from '../../ui/ui';
import { DemoStore } from '../../core/store';
import { formatReturnRate } from '../../core/money';
import { SIN_DATO } from '../../shared/utils/placeholders';

@Component({
  selector: 'app-portfolio-tab',
  standalone: true,
  imports: [DataTableComponent, KpiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-tab.html',
  styleUrl: '../../pages/workspace.css',
})
export class PortfolioTabComponent {
  readonly store = inject(DemoStore);

  readonly investmentColumns = [
    { key: 'name', label: 'Inversión' },
    { key: 'type', label: 'Tipo' },
    { key: 'institution', label: 'Institución' },
    { key: 'risk', label: 'Riesgo / liquidez' },
    { key: 'cost', label: 'Costo' },
    { key: 'value', label: 'Valor actual' },
    { key: 'return', label: 'Variación' },
  ];
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
