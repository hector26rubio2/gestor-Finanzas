import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import {
  type EntornoDeProyeccion,
  type MedidaDeComparacion,
  type VistaDeGrafica,
  comparacionDeEscenarios,
  conVista,
  crecimientoDeInversion,
  mesAMes,
  cuotasPorMes,
  flujoYMeta,
  interesesComparados,
  lineaDeTiempoDeDeudas,
  mapaDeDeudas,
  saldosEnElTiempo,
} from '@shared/proyecciones';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { compactMoney as formatCompactMoney } from '@shared/utils';
import type { ChartOption } from '@ui/chart';
import { ChartCardComponent, ChartThemeService } from '@ui/chart';
import { DateFieldComponent } from '@ui/date-field';
import { FieldComponent } from '@ui/field';
import { NumericInputDirective } from '@ui/numeric-input';
import { UiSelectComponent, type UiOption } from '@ui/select';
import { SimuladorDePlanificacion } from './simulador';
import { DeudasDelPlanComponent } from './partes/deudas-del-plan';
import { EventosDelPlanComponent } from './partes/eventos-del-plan';
import { FlujoDelPlanComponent } from './partes/flujo-del-plan';
import { VistasGuardadasComponent } from '@shared/vistas-guardadas';
import type { TipoDeVista } from '@core/api';

type PestanaDePlanificacion = 'Deudas' | 'Compra' | 'Vacaciones' | 'Inversión';

interface Metrica {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tono?: 'bien' | 'mal';
}

@Component({
  selector: 'app-planning-tab',
  imports: [
    ChartCardComponent,
    DateFieldComponent,
    FieldComponent,
    FormsModule,
    HlmButton,
    HlmInput,
    HlmTabsImports,
    NumericInputDirective,
    UiSelectComponent,
    VistasGuardadasComponent,
    DeudasDelPlanComponent,
    EventosDelPlanComponent,
    FlujoDelPlanComponent,
  ],
  providers: [SimuladorDePlanificacion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planning-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
})
export class PlanningTabComponent {
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly sim = inject(SimuladorDePlanificacion);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly temaGrafica = inject(ChartThemeService);

  readonly planningTabs: readonly PestanaDePlanificacion[] = ['Deudas', 'Compra', 'Vacaciones', 'Inversión'];
  private readonly planningTabLabels: Record<PestanaDePlanificacion, string> = {
    Deudas: 'planning.tab.debt',
    Compra: 'planning.tab.purchase',
    Vacaciones: 'planning.tab.vacation',
    Inversión: 'planning.tab.investment',
  };
  private readonly planningPermissions: Record<PestanaDePlanificacion, string> = {
    Deudas: P.planificacion.deudas.ver,
    Compra: P.planificacion.compras.ver,
    Vacaciones: P.planificacion.vacaciones.ver,
    Inversión: P.planificacion.inversiones.ver,
  };
  readonly visiblePlanningTabs = computed(() =>
    this.planningTabs.filter((tab) => this.capabilities.allows(this.planningPermissions[tab])),
  );
  readonly planningTab = signal<PestanaDePlanificacion>('Deudas');
  private readonly urlDePlanificacion = sincronizarConLaUrl('objetivo', this.planningTab, 'Deudas', (v) =>
    (this.planningTabs as readonly string[]).includes(v),
  );
  private readonly ajustarPlanificacion = effect(() => {
    const visibles = this.visiblePlanningTabs();
    if (visibles.length && !visibles.includes(this.planningTab())) this.planningTab.set(visibles[0]);
  });

  sufijo(tab: PestanaDePlanificacion): string {
    return this.planningTabLabels[tab].replace('planning.tab.', '');
  }

  private readonly tiposDePlan: Record<PestanaDePlanificacion, TipoDeVista> = {
    Deudas: 'plan.deudas',
    Compra: 'plan.compras',
    Vacaciones: 'plan.vacaciones',
    Inversión: 'plan.inversiones',
  };
  readonly tipoDePlan = computed(() => this.tiposDePlan[this.planningTab()]);

  tabLabel(tab: PestanaDePlanificacion): string {
    return this.i18n.t(this.planningTabLabels[tab]);
  }

  readonly ordenes = computed<UiOption[]>(() => [
    { value: 'tasa', label: this.i18n.t('planning.sim.order.rate') },
    { value: 'saldo', label: this.i18n.t('planning.sim.order.balance') },
  ]);

  money(valor: number): string {
    return this.store.money(valor);
  }
  compactMoney(valor: number): string {
    return formatCompactMoney(valor, this.store.preferences().locale);
  }
  numero(valor: unknown): number {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? Math.max(0, convertido) : 0;
  }

  private readonly entorno = computed<EntornoDeProyeccion>(() => ({
    palette: this.temaGrafica.palette(),
    etiquetas: this.sim.etiquetas(),
    dinero: (valor) => this.store.money(valor),
    t: (clave, params) => this.i18n.t(clave, params),
  }));

  readonly nombreDeEscenario = signal('');
  guardarEscenario(): void {
    this.sim.guardarEscenario(this.nombreDeEscenario());
    this.nombreDeEscenario.set('');
  }
  readonly vistas = computed<UiOption[]>(() =>
    (['original', 'linea', 'area', 'barras', 'apiladas'] as VistaDeGrafica[]).map((v) => ({
      value: v,
      label: this.i18n.t(`planning.sim.view.${v}`),
    })),
  );
  readonly medidas = computed<UiOption[]>(() =>
    (['saldoTotal', 'ahorroAcumulado', 'flujoLibre'] as MedidaDeComparacion[]).map((m) => ({
      value: m,
      label: this.i18n.t(`planning.sim.compare.${m}`),
    })),
  );
  private conVista(opcion: ChartOption): ChartOption {
    return conVista(opcion, this.sim.vista());
  }

  readonly graficaDeSaldos = computed(() =>
    this.conVista(saldosEnElTiempo(this.sim.base(), this.sim.escenario(), this.sim.eventos(), this.entorno())),
  );
  readonly graficaMesAMes = computed(() =>
    this.conVista(mesAMes(this.sim.escenario(), this.sim.flujoMensual(), this.entorno())),
  );
  readonly graficaDeComparacion = computed(() =>
    this.conVista(
      comparacionDeEscenarios(this.sim.escenariosAComparar(), this.sim.medidaDeComparacion(), this.entorno()),
    ),
  );
  readonly graficaDeCuotas = computed(() => this.conVista(cuotasPorMes(this.sim.escenario(), this.entorno())));
  readonly graficaDeIntereses = computed(() =>
    interesesComparados(this.sim.base(), this.sim.escenario(), this.entorno()),
  );
  readonly graficaDeLineaDeTiempo = computed(() =>
    lineaDeTiempoDeDeudas(this.sim.base(), this.sim.escenario(), this.entorno()),
  );
  readonly graficaDeMapa = computed(() => mapaDeDeudas(this.sim.deudasDelEscenario(), this.entorno()));
  readonly graficaDeFlujo = computed(() =>
    this.conVista(flujoYMeta(this.sim.escenario(), this.sim.metaMonto(), this.entorno())),
  );
  readonly graficaDeInversion = computed(() =>
    this.conVista(
      crecimientoDeInversion(this.sim.inversion(), { ...this.entorno(), etiquetas: this.sim.etiquetasDeInversion() }),
    ),
  );

  readonly metricas = computed<Metrica[]>(() => {
    const t = (clave: string, params?: Record<string, string | number>) => this.i18n.t(clave, params);
    const sim = this.sim;
    switch (this.planningTab()) {
      case 'Compra': {
        const serie = sim.serieDeLaCompra();
        return [
          {
            label: t('planning.sim.metric.purchaseInstallment'),
            value: this.money(sim.cuotaDeLaCompra()),
            hint: t('planning.sim.metric.purchaseInstallmentHint', { n: sim.compraCuotas() }),
          },
          {
            label: t('planning.sim.metric.purchaseInterest'),
            value: this.money(serie?.interesTotal ?? 0),
            hint: t('planning.sim.metric.purchaseInterestHint'),
          },
          {
            label: t('planning.sim.metric.minFreeCash'),
            value: this.money(sim.flujoLibreMinimo()),
            hint: t('planning.sim.metric.versus', { amount: this.money(sim.flujoLibreMinimoBase()) }),
            tono: sim.flujoLibreMinimo() < 0 ? 'mal' : 'bien',
          },
          {
            label: t('planning.sim.metric.purchaseEnds'),
            value: sim.etiquetaDeMes(serie?.mesFinal ?? null),
            hint: t('planning.sim.metric.purchaseEndsHint'),
          },
        ];
      }
      case 'Vacaciones':
        return [
          {
            label: t('planning.sim.metric.goal'),
            value: this.money(sim.metaMonto()),
            hint: t('planning.sim.metric.goalHint', { n: sim.mesesAlaMeta() }),
          },
          {
            label: t('planning.sim.metric.neededSaving'),
            value: this.money(sim.aporteNecesarioMeta()),
            hint: t('planning.sim.metric.neededSavingHint'),
          },
          {
            label: t('planning.sim.metric.avgFreeCash'),
            value: this.money(sim.flujoLibrePromedio()),
            hint: t('planning.sim.metric.avgFreeCashHint'),
            tono: sim.flujoLibrePromedio() >= sim.aporteNecesarioMeta() ? 'bien' : 'mal',
          },
          {
            label: t('planning.sim.metric.goalReached'),
            value: sim.etiquetaDeMes(sim.escenario().mesDeMeta),
            hint: t('planning.sim.metric.goalReachedHint'),
          },
        ];
      case 'Inversión': {
        const inversion = sim.inversion();
        return [
          {
            label: t('planning.sim.metric.finalValue'),
            value: this.money(inversion.valorFinal),
            hint: t('planning.sim.metric.finalValueHint', { n: sim.mesesDeInversion() }),
          },
          {
            label: t('planning.sim.metric.contributed'),
            value: this.money(inversion.aportadoFinal),
            hint: t('planning.sim.metric.contributedHint'),
          },
          {
            label: t('planning.sim.metric.yield'),
            value: this.money(inversion.rendimiento),
            hint: t('planning.sim.metric.yieldHint', { rate: sim.inversionTasa() }),
            tono: 'bien',
          },
        ];
      }
      default:
        return [
          {
            label: t('planning.sim.metric.totalDebt'),
            value: this.money(sim.deudaTotal()),
            hint: t('planning.sim.metric.monthlyNow', { amount: this.money(sim.cuotaDelPrimerMes()) }),
          },
          {
            label: t('planning.sim.metric.debtFree'),
            value: sim.etiquetaDeMes(sim.escenario().mesSinDeudas),
            hint: t('planning.sim.metric.withoutChanges', { month: sim.etiquetaDeMes(sim.base().mesSinDeudas) }),
          },
          {
            label: t('planning.sim.metric.interestSaved'),
            value: this.money(sim.interesAhorrado()),
            hint: t('planning.sim.metric.interestTotal', { amount: this.money(sim.escenario().interesTotal) }),
            tono: sim.interesAhorrado() >= 0 ? 'bien' : 'mal',
          },
          {
            label: t('planning.sim.metric.neededPayment'),
            value: this.money(sim.cuotaNecesaria()),
            hint: t('planning.sim.metric.neededPaymentHint', { n: sim.mesesAlObjetivo() }),
          },
        ];
    }
  });
}
