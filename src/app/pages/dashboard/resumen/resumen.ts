import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCard } from '@spartan-ng/helm/card';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { BudgetsStore, crearGastoPorCategoria, rangoDelMes } from '@features/budgets';
import { filasDePresupuesto } from '@shared/presupuestos';
import { compactMoney } from '@shared/utils';
import { BarraDeAvanceComponent } from '@ui/barra-de-avance';
import { ChartCardComponent, ChartThemeService, barrasConSaldo } from '@ui/chart';
import { EmptyStateComponent } from '@ui/empty-state';
import { IconComponent } from '@ui/icon';
import { KpiComponent } from '@ui/kpi';
import { KpiGridComponent } from '@ui/kpi-grid';
import { SkeletonComponent } from '@ui/skeleton';
import { CategoryListComponent } from '../widgets/category-list/category-list';
import { DatosDelTablero } from '../dashboard-datos';
import { DashboardPeriodo } from '../periodo/dashboard-periodo';
import { gastoInusual, tramosDirectos, tramosSemanales, variacionPorcentual } from './resumen-calculos';

const PRESUPUESTOS_VISIBLES = 5;

interface FilaDeVariacion {
  readonly clave: string;
  readonly etiqueta: string;
  readonly contraPeriodo: number | null;
  readonly contraAnio: number | null;
  readonly subirEsBueno: boolean;
}

@Component({
  selector: 'fin-resumen',
  imports: [
    BarraDeAvanceComponent,
    CategoryListComponent,
    ChartCardComponent,
    EmptyStateComponent,
    HlmButton,
    HlmCard,
    IconComponent,
    KpiComponent,
    KpiGridComponent,
    RouterLink,
    SkeletonComponent,
  ],
  templateUrl: './resumen.html',
  host: { class: 'flex min-w-0 flex-col gap-4', 'data-slot': 'resumen' },
})
export class ResumenComponent {
  readonly datos = input.required<DatosDelTablero>();

  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly P = P;
  private readonly caps = inject(CAPABILITIES);
  private readonly periodo = inject(DashboardPeriodo);
  private readonly tema = inject(ChartThemeService);
  readonly presupuestos = inject(BudgetsStore);

  readonly verKpis = computed(() => ({
    ingresos: this.caps.allows(P.dashboard.kpi.ingresos),
    gastos: this.caps.allows(P.dashboard.kpi.gastos),
    balance: this.caps.allows(P.dashboard.kpi.balance),
  }));
  readonly algunKpi = computed(() => Object.values(this.verKpis()).some(Boolean));
  readonly verFlujo = computed(() => this.caps.allows(P.dashboard.widget.flujo));
  readonly verCategorias = computed(() => this.caps.allows(P.dashboard.widget.categorias));
  readonly verMovimientos = computed(() => this.caps.allows(P.dashboard.tabla.ver));
  readonly verPresupuestos = computed(() => this.caps.allows(P.cuentas.categorias.listar));
  readonly puedeEditarPresupuestos = computed(() => this.caps.allows(P.cuentas.categorias.editar));

  private readonly previo = computed(() => {
    const historial = this.datos().historial();
    return historial.length > 1 ? historial[historial.length - 2] : null;
  });
  private readonly anioAnterior = computed(() => this.datos().historialAnual()[0] ?? null);

  readonly tasaDeAhorro = computed(() => {
    const ingresos = this.datos().income();
    return ingresos > 0 ? Math.round((this.datos().net() / ingresos) * 100) : null;
  });
  private readonly tasaPrevia = computed(() => {
    const previo = this.previo();
    return previo && previo.income > 0 ? Math.round((previo.net / previo.income) * 100) : null;
  });
  readonly cambioDeLaTasa = computed(() => {
    const actual = this.tasaDeAhorro();
    const previa = this.tasaPrevia();
    return actual === null || previa === null ? null : variacionPorcentual(actual, previa);
  });
  readonly cambioDeIngresos = computed(() => variacionPorcentual(this.datos().income(), this.previo()?.income ?? null));
  readonly cambioDeGastos = computed(() => variacionPorcentual(this.datos().expense(), this.previo()?.expense ?? null));
  readonly cambioDelNeto = computed(() => variacionPorcentual(this.datos().net(), this.previo()?.net ?? null));

  readonly variaciones = computed<readonly FilaDeVariacion[]>(() => {
    const datos = this.datos();
    const previo = this.previo();
    const anio = this.anioAnterior();
    const filas: FilaDeVariacion[] = [];
    const agregar = (
      clave: string,
      actual: number,
      base: (punto: NonNullable<typeof previo>) => number,
      subir: boolean,
    ) =>
      filas.push({
        clave,
        etiqueta: this.i18n.t(`summary.kpi.${clave}`),
        contraPeriodo: variacionPorcentual(actual, previo ? base(previo) : null),
        contraAnio: variacionPorcentual(actual, anio ? base(anio) : null),
        subirEsBueno: subir,
      });
    if (this.verKpis().ingresos) agregar('income', datos.income(), (punto) => punto.income, true);
    if (this.verKpis().gastos) agregar('expense', datos.expense(), (punto) => punto.expense, false);
    if (this.verKpis().balance) agregar('net', datos.net(), (punto) => punto.net, true);
    return filas;
  });

  readonly tramos = computed(() => {
    const datos = this.datos();
    const puntos = datos.timeline();
    return this.periodo.scale() === 'month'
      ? tramosSemanales(puntos, (inicio, fin) => this.i18n.t('summary.flow.week', { start: inicio, end: fin }))
      : tramosDirectos(puntos);
  });
  readonly tituloDelFlujo = computed(() =>
    this.i18n.t(this.periodo.scale() === 'month' ? 'summary.flow.title' : 'summary.flow.titleDirect'),
  );
  readonly graficaDelFlujo = computed(() => {
    const tramos = this.tramos();
    return barrasConSaldo(
      this.tema.palette(),
      {
        etiquetas: tramos.map((tramo) => tramo.etiqueta),
        ingresos: tramos.map((tramo) => tramo.ingresos),
        gastos: tramos.map((tramo) => tramo.gastos),
        saldo: tramos.map((tramo) => tramo.saldo),
        nombres: {
          ingresos: this.i18n.t('summary.kpi.income'),
          gastos: this.i18n.t('summary.kpi.expense'),
          saldo: this.i18n.t('summary.flow.balance'),
        },
      },
      (valor) => this.store.money(valor),
      (valor) => compactMoney(valor, this.store.preferences().locale),
    );
  });

  readonly inusual = computed(() => gastoInusual(this.datos().movements()));

  private readonly mesDelPresupuesto = computed(() => rangoDelMes(this.periodo.anchor()));
  private readonly gastoDelMes = crearGastoPorCategoria(this.mesDelPresupuesto);
  readonly etiquetaDelMes = computed(() =>
    new Intl.DateTimeFormat(this.store.preferences().locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${this.mesDelPresupuesto().start}T12:00:00Z`)),
  );
  private readonly filasDePresupuestos = computed(() =>
    filasDePresupuesto({
      categorias: this.store.categories(),
      presupuestos: this.presupuestos.items(),
      gastoPorCategoria: this.gastoDelMes.gastoPorCategoria(),
      monedaBase: this.store.baseCurrency(),
    }).filter((fila) => fila.estado !== null),
  );
  readonly presupuestosVisibles = computed(() => this.filasDePresupuestos().slice(0, PRESUPUESTOS_VISIBLES));
  readonly presupuestosOcultos = computed(() => Math.max(0, this.filasDePresupuestos().length - PRESUPUESTOS_VISIBLES));

  constructor() {
    if (this.verPresupuestos()) void this.presupuestos.asegurarCarga();
  }

  dinero(valor: number): string {
    return this.store.money(valor);
  }

  porcentajeConSigno(valor: number | null): string {
    if (valor === null) return this.i18n.t('summary.variation.none');
    const redondeado = Math.abs(valor) >= 10 ? Math.round(valor) : Math.round(valor * 10) / 10;
    return `${redondeado > 0 ? '+' : ''}${redondeado} %`;
  }

  claseDeVariacion(valor: number | null, subirEsBueno: boolean): string {
    if (valor === null || Math.round(valor * 10) === 0) return 'text-muted-foreground';
    return valor > 0 === subirEsBueno ? 'text-success' : 'text-destructive';
  }
}
