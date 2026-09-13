import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';
import { sincronizarConLaUrl } from '../../core/url-state';
import { chartPoints, compactMoney as formatCompactMoney } from '../../shared/utils/chart-math';

@Component({
  selector: 'app-planning-tab',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planning-tab.html',
  styleUrl: './planning-tab.css',
})
export class PlanningTabComponent {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly planningTabs = ['Deudas', 'Compra', 'Vacaciones', 'Inversión'] as const;

  /** Etiqueta visible de cada pestaña; el identificador interno no cambia con el idioma. */
  private readonly planningTabLabels: Record<(typeof this.planningTabs)[number], string> = {
    Deudas: 'planning.tab.debt',
    Compra: 'planning.tab.purchase',
    Vacaciones: 'planning.tab.vacation',
    Inversión: 'planning.tab.investment',
  };
  tabLabel(tab: (typeof this.planningTabs)[number]): string {
    return this.i18n.t(this.planningTabLabels[tab]);
  }

  /** Cada simulación se libera por separado: se puede planificar deudas y no vacaciones. */
  private readonly planningPermissions: Record<(typeof this.planningTabs)[number], string> = {
    Deudas: P.planificacion.deudas.ver,
    Compra: P.planificacion.compras.ver,
    Vacaciones: P.planificacion.vacaciones.ver,
    Inversión: P.planificacion.inversiones.ver,
  };
  readonly visiblePlanningTabs = computed(() =>
    this.planningTabs.filter((tab) => this.can(this.planningPermissions[tab])),
  );
  readonly planningTab = signal<(typeof this.planningTabs)[number]>('Deudas');
  private readonly urlDePlanificacion = sincronizarConLaUrl('objetivo', this.planningTab, 'Deudas', (v) =>
    (this.planningTabs as readonly string[]).includes(v),
  );
  private readonly ajustarPlanificacion = effect(() => {
    const visibles = this.visiblePlanningTabs();
    if (visibles.length && !visibles.includes(this.planningTab())) this.planningTab.set(visibles[0]);
  });
  readonly monthly = signal(1200000);
  targetDate = '2027-08-31';
  readonly currentMonths = computed(() => Math.max(1, Math.ceil(this.store.debt() / 650000)));
  readonly proposedMonths = computed(() => Math.max(1, Math.ceil(this.store.debt() / Math.max(1, this.monthly()))));
  readonly currentInterest = computed(() => Math.round(this.store.debt() * 0.018 * this.currentMonths()));
  readonly proposedInterest = computed(() => Math.round(this.store.debt() * 0.018 * this.proposedMonths()));
  readonly estimatedSavings = computed(() => Math.max(0, this.currentInterest() - this.proposedInterest()));
  /** Mismo calculo que Patrimonio: se repite aqui porque el escenario de inversion lo necesita. */
  readonly investmentValue = computed(() => this.store.data().investments.reduce((s, i) => s + i.value, 0));
  compactMoney(value: number): string {
    return formatCompactMoney(value, this.store.preferences().locale);
  }
  readonly planningCopy = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          parameterTitle: this.i18n.t('planning.purchase.parameterTitle'),
          amountLabel: this.i18n.t('planning.purchase.amountLabel'),
          helper: this.i18n.t('planning.purchase.helper'),
          rangeHint: this.i18n.t('planning.purchase.rangeHint'),
          assumption: this.i18n.t('planning.purchase.assumption'),
          chartTitle: this.i18n.t('planning.purchase.chartTitle'),
          chartDescription: this.i18n.t('planning.purchase.chartDescription'),
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: this.i18n.t('planning.purchase.currentLabel'),
          proposedLabel: this.i18n.t('planning.purchase.proposedLabel'),
        };
      case 'Vacaciones':
        return {
          parameterTitle: this.i18n.t('planning.vacation.parameterTitle'),
          amountLabel: this.i18n.t('planning.vacation.amountLabel'),
          helper: this.i18n.t('planning.vacation.helper'),
          rangeHint: this.i18n.t('planning.vacation.rangeHint'),
          assumption: this.i18n.t('planning.vacation.assumption'),
          chartTitle: this.i18n.t('planning.vacation.chartTitle'),
          chartDescription: this.i18n.t('planning.vacation.chartDescription'),
          min: 100000,
          max: 5000000,
          step: 100000,
          currentLabel: this.i18n.t('planning.vacation.currentLabel'),
          proposedLabel: this.i18n.t('planning.vacation.proposedLabel'),
        };
      case 'Inversión':
        return {
          parameterTitle: this.i18n.t('planning.investment.parameterTitle'),
          amountLabel: this.i18n.t('planning.investment.amountLabel'),
          helper: this.i18n.t('planning.investment.helper'),
          rangeHint: this.i18n.t('planning.investment.rangeHint'),
          assumption: this.i18n.t('planning.investment.assumption'),
          chartTitle: this.i18n.t('planning.investment.chartTitle'),
          chartDescription: this.i18n.t('planning.investment.chartDescription'),
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: this.i18n.t('planning.investment.currentLabel'),
          proposedLabel: this.i18n.t('planning.investment.proposedLabel'),
        };
      default:
        return {
          parameterTitle: this.i18n.t('planning.debt.parameterTitle'),
          amountLabel: this.i18n.t('planning.debt.amountLabel'),
          helper: this.i18n.t('planning.debt.helper'),
          rangeHint: this.i18n.t('planning.debt.rangeHint'),
          assumption: this.i18n.t('planning.debt.assumption'),
          chartTitle: this.i18n.t('planning.debt.chartTitle'),
          chartDescription: this.i18n.t('planning.debt.chartDescription'),
          min: 100000,
          max: 5000000,
          step: 50000,
          currentLabel: this.i18n.t('planning.debt.currentLabel'),
          proposedLabel: this.i18n.t('planning.debt.proposedLabel'),
        };
    }
  });
  readonly planningCurrent = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available()),
          detail: this.i18n.t('planning.purchase.current.detail'),
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.store.available()),
          detail: this.i18n.t('planning.vacation.current.detail'),
        };
      case 'Inversión':
        return {
          headline: this.store.money(this.investmentValue()),
          detail: this.i18n.t('planning.investment.current.detail'),
        };
      default:
        return {
          headline: this.i18n.t('planning.debt.current.headline', { months: this.currentMonths() }),
          detail: this.i18n.t('planning.debt.current.detail', { amount: this.store.money(this.currentInterest()) }),
        };
    }
  });
  readonly planningProposed = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available() - this.monthly()),
          detail: this.i18n.t('planning.purchase.proposed.detail'),
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.monthly() * 12),
          detail: this.i18n.t('planning.vacation.proposed.detail'),
        };
      case 'Inversión':
        return {
          headline: this.store.money(Math.round(this.monthly() * 1.1)),
          detail: this.i18n.t('planning.investment.proposed.detail'),
        };
      default:
        return {
          headline: this.i18n.t('planning.debt.proposed.headline', { months: this.proposedMonths() }),
          detail: this.i18n.t('planning.debt.proposed.detail', {
            amount: this.store.money(this.estimatedSavings()),
          }),
        };
    }
  });
  readonly planningSeries = computed(() => {
    const amount = this.monthly();
    const available = Math.max(0, this.store.available());
    const debt = Math.max(0, this.store.debt());
    const investment = Math.max(0, this.investmentValue());
    return Array.from({ length: 13 }, (_, month) => {
      switch (this.planningTab()) {
        case 'Compra':
          return { current: available, proposed: Math.max(0, available - amount - month * amount * 0.01) };
        case 'Vacaciones':
          return { current: 0, proposed: amount * month };
        case 'Inversión':
          return { current: investment + amount, proposed: investment + amount * Math.pow(1.1, month / 12) };
        default:
          return {
            current: Math.max(0, debt - month * 650000),
            proposed: Math.max(0, debt - month * amount),
          };
      }
    });
  });
  readonly planningChartMax = computed(() =>
    Math.max(1, ...this.planningSeries().flatMap((point) => [point.current, point.proposed])),
  );
  readonly planningCurrentPoints = computed(() =>
    chartPoints(
      this.planningSeries().map((point) => point.current),
      this.planningChartMax(),
      600,
      220,
    ),
  );
  readonly planningProposedPoints = computed(() =>
    chartPoints(
      this.planningSeries().map((point) => point.proposed),
      this.planningChartMax(),
      600,
      220,
    ),
  );
  readonly planningMetrics = computed(() => {
    const current = this.planningCurrent();
    const proposed = this.planningProposed();
    switch (this.planningTab()) {
      case 'Compra':
        return [
          {
            label: this.i18n.t('planning.purchase.metric.available.label'),
            value: current.headline,
            hint: this.i18n.t('planning.purchase.metric.available.hint'),
          },
          {
            label: this.i18n.t('planning.purchase.metric.estimated.label'),
            value: proposed.headline,
            hint: this.i18n.t('planning.purchase.metric.estimated.hint'),
          },
          {
            label: this.i18n.t('planning.purchase.metric.impact.label'),
            value: this.store.money(this.monthly()),
            hint: this.i18n.t('planning.purchase.metric.impact.hint'),
          },
        ];
      case 'Vacaciones':
        return [
          {
            label: this.i18n.t('planning.vacation.metric.contribution.label'),
            value: this.store.money(this.monthly()),
            hint: this.i18n.t('planning.vacation.metric.contribution.hint'),
          },
          {
            label: this.i18n.t('planning.vacation.metric.goal.label'),
            value: proposed.headline,
            hint: this.i18n.t('planning.vacation.metric.goal.hint'),
          },
          {
            label: this.i18n.t('planning.vacation.metric.effort.label'),
            value: `${Math.round((this.monthly() / Math.max(1, this.store.available())) * 100)} %`,
            hint: this.i18n.t('planning.vacation.metric.effort.hint'),
          },
        ];
      case 'Inversión':
        return [
          {
            label: this.i18n.t('planning.investment.metric.initial.label'),
            value: this.store.money(this.monthly()),
            hint: this.i18n.t('planning.investment.metric.initial.hint'),
          },
          {
            label: this.i18n.t('planning.investment.metric.value12.label'),
            value: proposed.headline,
            hint: this.i18n.t('planning.investment.metric.value12.hint'),
          },
          {
            label: this.i18n.t('planning.investment.metric.gain.label'),
            value: this.store.money(Math.round(this.monthly() * 0.1)),
            hint: this.i18n.t('planning.investment.metric.gain.hint'),
          },
        ];
      default:
        return [
          {
            label: this.i18n.t('planning.debt.metric.currentTerm.label'),
            value: current.headline,
            hint: this.i18n.t('planning.debt.metric.currentTerm.hint'),
          },
          {
            label: this.i18n.t('planning.debt.metric.newTerm.label'),
            value: proposed.headline,
            hint: this.i18n.t('planning.debt.metric.newTerm.hint', { amount: this.compactMoney(this.monthly()) }),
          },
          {
            label: this.i18n.t('planning.debt.metric.savedInterest.label'),
            value: this.store.money(this.estimatedSavings()),
            hint: this.i18n.t('planning.debt.metric.savedInterest.hint'),
          },
        ];
    }
  });
}
