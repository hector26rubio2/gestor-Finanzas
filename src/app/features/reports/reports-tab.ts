import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toCsv, downloadCsv } from '../../core/csv';
import { IconComponent } from '../../ui/icon';
import { KpiComponent } from '../../ui/ui';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { sincronizarConLaUrl } from '../../core/url-state';
import { chartPoints, compactMoney as formatCompactMoney } from '../../shared/utils/chart-math';

@Component({
  selector: 'app-reports-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, KpiComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-tab.html',
  styleUrl: './reports-tab.css',
})
export class ReportsTabComponent {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly reportPeriod = signal('6');
  readonly reportPeriodOptions: readonly UiOption[] = [
    { value: '3', label: '3 meses' },
    { value: '6', label: '6 meses' },
    { value: '12', label: '12 meses' },
  ];
  private readonly urlDeReportes = sincronizarConLaUrl('meses', this.reportPeriod, '6', (v) =>
    ['3', '6', '12'].includes(v),
  );
  readonly reportMovements = computed(() => {
    const periods = [...new Set(this.store.data().movements.map((movement) => movement.date.slice(0, 7)))]
      .sort()
      .slice(-Number(this.reportPeriod()));
    return this.store.data().movements.filter((movement) => periods.includes(movement.date.slice(0, 7)));
  });
  readonly reportIncome = computed(() =>
    this.reportMovements()
      .filter((movement) => movement.amount > 0)
      .reduce((sum, movement) => sum + movement.amount, 0),
  );
  readonly reportExpenses = computed(
    () =>
      -this.reportMovements()
        .filter((movement) => movement.amount < 0)
        .reduce((sum, movement) => sum + movement.amount, 0),
  );
  readonly reportNet = computed(() => this.reportIncome() - this.reportExpenses());
  readonly reportSavingsRate = computed(() =>
    this.reportIncome() ? `${Math.round((this.reportNet() / this.reportIncome()) * 100)} %` : '0 %',
  );
  readonly reportAverageExpense = computed(() => this.reportExpenses() / Number(this.reportPeriod()));
  readonly reportSeries = computed(() => {
    const grouped = new Map<string, { income: number; expense: number }>();
    for (const movement of this.reportMovements()) {
      const month = movement.date.slice(0, 7);
      const values = grouped.get(month) ?? { income: 0, expense: 0 };
      if (movement.amount >= 0) values.income += movement.amount;
      else values.expense -= movement.amount;
      grouped.set(month, values);
    }
    const maximum = Math.max(1, ...[...grouped.values()].flatMap((value) => [value.income, value.expense]));
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => ({
        month: new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
          .format(new Date(`${month}-01T00:00:00Z`))
          .replace('.', ''),
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
        incomePercent: Math.round((values.income / maximum) * 100),
        expensePercent: Math.round((values.expense / maximum) * 100),
      }));
  });
  readonly reportCategories = computed(() => {
    const totals = new Map<string, number>();
    for (const movement of this.reportMovements()) {
      if (movement.amount < 0) totals.set(movement.category, (totals.get(movement.category) ?? 0) - movement.amount);
    }
    const palette = ['#0f766e', '#2563eb', '#e76f51', '#8b5cf6', '#d97706', '#64748b'];
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    return [...totals.entries()]
      .sort(([, left], [, right]) => right - left)
      .slice(0, 6)
      .map(([name, value], index) => ({
        name,
        color: palette[index % palette.length],
        percent: total ? Math.round((value / total) * 100) : 0,
        value,
      }));
  });
  readonly reportNetRange = computed(() => Math.max(1, ...this.reportSeries().map((point) => Math.abs(point.net))));
  readonly reportNetPoints = computed(() =>
    chartPoints(
      this.reportSeries().map((point) => point.net + this.reportNetRange()),
      this.reportNetRange() * 2,
      600,
      160,
    ),
  );
  readonly topCategory = computed(() => {
    const values = new Map<string, number>();
    this.reportMovements()
      .filter((movement) => movement.amount < 0)
      .forEach((movement) => values.set(movement.category, (values.get(movement.category) ?? 0) - movement.amount));
    const top = [...values.entries()].sort((a, b) => b[1] - a[1])[0];
    return { name: top?.[0] ?? 'Sin datos', value: top?.[1] ?? 0 };
  });
  /** Mismo calculo que Patrimonio: se repite aqui porque el widget de salud de deuda lo necesita. */
  readonly investmentValue = computed(() => this.store.data().investments.reduce((s, i) => s + i.value, 0));
  compactMoney(value: number): string {
    return formatCompactMoney(value, this.store.preferences().locale);
  }
  /**
   * Exporta el periodo del informe: una fila por mes con ingresos, gastos y neto, y
   * debajo el reparto por categoria. Es lo que protege `reportes.exportar`.
   */
  exportReport(): void {
    const SALTO = '\r\n';
    if (!this.can(P.reportes.exportar)) return;
    const meses = toCsv(this.reportSeries(), [
      { header: 'Mes', value: (fila) => fila.month },
      { header: 'Ingresos', value: (fila) => fila.income },
      { header: 'Gastos', value: (fila) => fila.expense },
      { header: 'Neto', value: (fila) => fila.net },
    ]);
    const categorias = toCsv(this.reportCategories(), [
      { header: 'Categoria', value: (fila) => fila.name },
      { header: 'Gasto', value: (fila) => fila.value },
      { header: 'Porcentaje', value: (fila) => fila.percent },
    ]);
    const periodo = `Periodo;${this.reportPeriod()} meses`;
    downloadCsv(`finanzas-reporte-${this.reportPeriod()}m.csv`, [periodo, '', meses, '', categorias].join(SALTO));
    this.store.toast.set('Reporte exportado.');
  }
}
