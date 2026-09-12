import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
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
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly planningTabs = ['Deudas', 'Compra', 'Vacaciones', 'Inversión'] as const;

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
          parameterTitle: 'Simular una compra',
          amountLabel: 'Valor de la compra',
          helper: 'Mide el impacto de una compra sobre tu liquidez durante los próximos doce meses.',
          rangeHint: 'Incluye el valor total que quieres financiar o pagar.',
          assumption: 'Distribución lineal del impacto, sin nuevas compras ni cambios de ingreso.',
          chartTitle: 'Liquidez disponible después de la compra',
          chartDescription: 'Saldo disponible estimado, comparando no comprar frente a realizar la compra.',
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: 'Sin la compra',
          proposedLabel: 'Con la compra',
        };
      case 'Vacaciones':
        return {
          parameterTitle: 'Plan de vacaciones',
          amountLabel: 'Aporte mensual',
          helper: 'Comprueba cuánto acumularías separando una cantidad fija cada mes.',
          rangeHint: 'El aporte se descuenta de la liquidez mensual disponible.',
          assumption: 'Doce aportes iguales, sin rentabilidad y sin retiros anticipados.',
          chartTitle: 'Ahorro acumulado para el viaje',
          chartDescription: 'Capital reservado mes a mes, comparando el ahorro actual con el plan propuesto.',
          min: 100000,
          max: 5000000,
          step: 100000,
          currentLabel: 'Ahorro actual',
          proposedLabel: 'Plan mensual',
        };
      case 'Inversión':
        return {
          parameterTitle: 'Simular inversión',
          amountLabel: 'Capital a invertir',
          helper: 'Explora un escenario de rentabilidad sin afectar el patrimonio registrado.',
          rangeHint: 'Capital inicial aplicado una sola vez.',
          assumption: 'Rentabilidad anual supuesta del 10 %, compuesta mensualmente; no incluye impuestos.',
          chartTitle: 'Valor proyectado de la inversión',
          chartDescription: 'Evolución estimada del capital sin invertir frente al escenario invertido.',
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: 'Capital disponible',
          proposedLabel: 'Proyección a 12 meses',
        };
      default:
        return {
          parameterTitle: 'Plan de deuda',
          amountLabel: 'Abono mensual',
          helper: 'Compara el ritmo actual de pago con un abono mensual mayor.',
          rangeHint: 'El cálculo distribuye el pago sobre el saldo total registrado.',
          assumption: 'Tasa mensual estimada de 1,8 % y ausencia de nuevas compras.',
          chartTitle: 'Saldo de deuda pendiente',
          chartDescription: 'Reducción estimada del saldo durante doce meses con el pago actual y el propuesto.',
          min: 100000,
          max: 5000000,
          step: 50000,
          currentLabel: 'Ritmo actual',
          proposedLabel: 'Con el abono propuesto',
        };
    }
  });
  readonly planningCurrent = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available()),
          detail: 'Disponible antes de realizar la compra.',
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.store.available()),
          detail: 'Liquidez disponible sin separar un ahorro mensual.',
        };
      case 'Inversión':
        return {
          headline: this.store.money(this.investmentValue()),
          detail: 'Valor estimado de las inversiones registradas.',
        };
      default:
        return {
          headline: `${this.currentMonths()} meses`,
          detail: `${this.store.money(this.currentInterest())} de intereses estimados al ritmo actual.`,
        };
    }
  });
  readonly planningProposed = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available() - this.monthly()),
          detail: 'Disponible estimado después de la compra simulada.',
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.monthly() * 12),
          detail: 'Ahorro acumulado en doce meses con el aporte seleccionado.',
        };
      case 'Inversión':
        return {
          headline: this.store.money(Math.round(this.monthly() * 1.1)),
          detail: 'Proyección ilustrativa a un año con una rentabilidad supuesta del 10 %.',
        };
      default:
        return {
          headline: `${this.proposedMonths()} meses`,
          detail: `Ahorrarías aproximadamente ${this.store.money(this.estimatedSavings())} en intereses.`,
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
          { label: 'Disponible actual', value: current.headline, hint: 'Antes de comprar' },
          { label: 'Disponible estimado', value: proposed.headline, hint: 'Después de comprar' },
          { label: 'Impacto inmediato', value: this.store.money(this.monthly()), hint: 'Valor simulado' },
        ];
      case 'Vacaciones':
        return [
          { label: 'Aporte mensual', value: this.store.money(this.monthly()), hint: 'Durante 12 meses' },
          { label: 'Meta acumulada', value: proposed.headline, hint: 'Sin rendimientos' },
          {
            label: 'Esfuerzo sobre liquidez',
            value: `${Math.round((this.monthly() / Math.max(1, this.store.available())) * 100)} %`,
            hint: 'Del disponible actual',
          },
        ];
      case 'Inversión':
        return [
          { label: 'Capital inicial', value: this.store.money(this.monthly()), hint: 'Aporte simulado' },
          { label: 'Valor a 12 meses', value: proposed.headline, hint: 'Rentabilidad supuesta: 10 %' },
          {
            label: 'Ganancia estimada',
            value: this.store.money(Math.round(this.monthly() * 0.1)),
            hint: 'Antes de impuestos',
          },
        ];
      default:
        return [
          { label: 'Plazo actual', value: current.headline, hint: 'Pagando $650 mil/mes' },
          { label: 'Nuevo plazo', value: proposed.headline, hint: `Pagando ${this.compactMoney(this.monthly())}/mes` },
          {
            label: 'Intereses evitados',
            value: this.store.money(this.estimatedSavings()),
            hint: 'Estimación acumulada',
          },
        ];
    }
  });
}
