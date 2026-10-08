import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmCard } from '@spartan-ng/helm/card';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { ExploradorDeReportesComponent } from './explorador/explorador';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import type { Account } from '@core/state';
import {
  CAPABILITIES,
  AppStore,
  esEconomico,
  esGasto,
  montoDeGasto,
  montoDeIngreso,
  totalDeGastos,
  totalDeIngresos,
} from '@core/state';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import { addMonthsToIso, downloadCsv, toCsv, todayIso, sumBy } from '@core/utils';
import { HeaderActionsService } from '@shared/header-actions.service';
import { Rango, crearMovimientosDelPeriodo } from '@shared/historia';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { compactMoney as formatCompactMoney, SIN_DATO } from '@shared/utils';
import { ChartComponent, ChartThemeService, anillo, barrasAgrupadas, lineaConCero, medidor } from '@ui/chart';
import { IconComponent } from '@ui/icon';
import { KpiComponent } from '@ui/kpi';
import { KpiGridComponent } from '@ui/kpi-grid';
import { UiOption, UiSelectComponent } from '@ui/select';
import { HEALTHY_UTILIZATION_PERCENT, creditCards, nextCardDue } from '@features/accounts/card-insights';

@Component({
  selector: 'app-reports-tab',
  imports: [
    FormsModule,
    HlmCard,
    HlmTabsImports,
    ExploradorDeReportesComponent,
    ChartComponent,
    IconComponent,
    KpiComponent,
    KpiGridComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
})
export class ReportsTabComponent implements OnInit, OnDestroy {
  readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly headerActions = inject(HeaderActionsService);
  private readonly temaGrafica = inject(ChartThemeService);
  readonly i18n = inject(I18nService);
  readonly P = P;
  readonly sinDato = SIN_DATO;

  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  ngOnInit(): void {
    this.headerActions.exportReport.set(() => this.exportReport());
  }

  ngOnDestroy(): void {
    this.headerActions.exportReport.set(null);
  }

  readonly seccion = signal<'summary' | 'explorer'>('summary');
  private readonly urlDeSeccion = sincronizarConLaUrl(
    'vista',
    this.seccion,
    'summary',
    (v) => v === 'summary' || v === 'explorer',
  );
  readonly reportPeriod = signal('6');
  readonly reportPeriodOptions = computed<readonly UiOption[]>(() => [
    { value: '3', label: this.i18n.t('reports.period.3') },
    { value: '6', label: this.i18n.t('reports.period.6') },
    { value: '12', label: this.i18n.t('reports.period.12') },
  ]);
  private readonly urlDeReportes = sincronizarConLaUrl('meses', this.reportPeriod, '6', (v) =>
    ['3', '6', '12'].includes(v),
  );

  private readonly periodos = computed(() => {
    const hoy = this.store.hoy();
    const meses = Number(this.reportPeriod());
    return Array.from({ length: meses }, (_, indice) =>
      addMonthsToIso(`${hoy.slice(0, 7)}-01`, indice - meses + 1).slice(0, 7),
    );
  });
  private readonly rangoDelReporte = computed<Rango>(() => ({
    start: `${this.periodos()[0]}-01`,
    end: this.store.hoy(),
  }));
  private readonly delPeriodo = crearMovimientosDelPeriodo(this.rangoDelReporte);
  readonly cargando = this.delPeriodo.cargando;
  readonly reportMovements = this.delPeriodo.movimientos;
  private readonly economicos = computed(() => this.reportMovements().filter(esEconomico));
  private readonly gastos = computed(() => this.economicos().filter(esGasto));

  readonly reportIncome = computed(() => totalDeIngresos(this.economicos()));
  readonly reportExpenses = computed(() => totalDeGastos(this.gastos()));
  readonly reportNet = computed(() => this.reportIncome() - this.reportExpenses());
  readonly reportSavingsRate = computed(() =>
    this.reportIncome() ? `${Math.round((this.reportNet() / this.reportIncome()) * 100)} %` : '0 %',
  );
  readonly reportAverageExpense = computed(() => this.reportExpenses() / Number(this.reportPeriod()));

  private readonly nombreDeMes = computed(() => {
    const formato = new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'short', timeZone: 'UTC' });
    return (mes: string) => formato.format(new Date(`${mes}-01T00:00:00Z`)).replace('.', '');
  });

  readonly reportSeries = computed(() => {
    const agrupados = new Map<string, { income: number; expense: number }>(
      this.periodos().map((mes) => [mes, { income: 0, expense: 0 }]),
    );
    for (const movement of this.economicos()) {
      const mes = movement.date.slice(0, 7);
      const valores = agrupados.get(mes) ?? { income: 0, expense: 0 };
      valores.income += montoDeIngreso(movement);
      valores.expense += montoDeGasto(movement);
      agrupados.set(mes, valores);
    }
    const nombre = this.nombreDeMes();
    return [...agrupados.entries()]
      .sort(([izquierda], [derecha]) => izquierda.localeCompare(derecha))
      .map(([mes, valores]) => ({
        key: mes,
        month: nombre(mes),
        income: valores.income,
        expense: valores.expense,
        net: valores.income - valores.expense,
      }));
  });

  readonly reportCategories = computed(() => {
    const totales = new Map<string, number>();
    for (const movement of this.gastos())
      totales.set(movement.category, (totales.get(movement.category) ?? 0) + montoDeGasto(movement));
    const total = sumBy([...totales.values()], (valor) => valor);
    return [...totales.entries()]
      .sort(([, izquierda], [, derecha]) => derecha - izquierda)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value, percent: total ? Math.round((value / total) * 100) : 0 }));
  });

  readonly topCategory = computed(() => {
    const primera = this.reportCategories()[0];
    return { name: primera?.name ?? this.i18n.t('people.noData'), value: primera?.value ?? 0 };
  });

  readonly investmentValue = computed(() => sumBy(this.store.data().investments, (inversion) => inversion.value));

  compactMoney(value: number): string {
    return formatCompactMoney(value, this.store.preferences().locale);
  }

  private readonly dinero = (valor: number) => this.store.money(valor);
  private readonly compacto = (valor: number) => this.compactMoney(valor);

  readonly incomeExpenseOption = computed(() => {
    const palette = this.temaGrafica.palette();
    const serie = this.reportSeries();
    return barrasAgrupadas(
      palette,
      serie.map((punto) => punto.month),
      [
        {
          nombre: this.i18n.t('reports.legend.income'),
          valores: serie.map((punto) => punto.income),
          color: palette.success,
        },
        {
          nombre: this.i18n.t('reports.legend.expense'),
          valores: serie.map((punto) => punto.expense),
          color: palette.danger,
        },
      ],
      this.dinero,
      this.compacto,
    );
  });

  readonly categoriesOption = computed(() =>
    anillo(
      this.temaGrafica.palette(),
      this.reportCategories().map((categoria) => ({ nombre: categoria.name, valor: categoria.value })),
      this.dinero,
      { valor: this.compactMoney(this.reportExpenses()), etiqueta: this.i18n.t('reports.categories.totalLabel') },
    ),
  );

  readonly trendOption = computed(() => {
    const palette = this.temaGrafica.palette();
    const serie = this.reportSeries();
    return lineaConCero(
      palette,
      serie.map((punto) => punto.month),
      [
        {
          nombre: this.i18n.t('reports.trend.series'),
          valores: serie.map((punto) => punto.net),
          color: palette.accent,
        },
      ],
      this.dinero,
      this.compacto,
    );
  });

  private readonly tarjetas = computed(() => creditCards(this.store.data().accounts));
  private readonly deudaDe = (tarjeta: Account) => Math.max(0, -this.store.balance(tarjeta));

  readonly utilization = computed(() => {
    const cupo = sumBy(this.tarjetas(), (tarjeta) => tarjeta.limit ?? 0);
    return cupo > 0 ? (sumBy(this.tarjetas(), this.deudaDe) / cupo) * 100 : null;
  });
  readonly utilizationOption = computed(() =>
    medidor(
      this.temaGrafica.palette(),
      this.utilization() ?? 0,
      this.i18n.t('reports.debtHealth.utilization.label'),
      HEALTHY_UTILIZATION_PERCENT,
    ),
  );
  readonly nextDue = computed(() => {
    const proximo = nextCardDue(this.tarjetas(), this.deudaDe, todayIso());
    if (!proximo) return null;
    const fecha = new Intl.DateTimeFormat(this.store.preferences().locale, { day: 'numeric', month: 'short' }).format(
      new Date(proximo.date),
    );
    return { fecha, tarjeta: proximo.account.name };
  });
  readonly estimatedInterest = computed(() => {
    const conTasa = this.tarjetas().filter((tarjeta) => tarjeta.annualRate !== undefined);
    if (!conTasa.length) return null;
    return sumBy(conTasa, (tarjeta) => (this.deudaDe(tarjeta) * (tarjeta.annualRate ?? 0)) / 100 / 12);
  });

  readonly insights = computed(() => {
    const t = (clave: string, parametros?: Record<string, string | number>) => this.i18n.t(clave, parametros);
    const total = this.reportExpenses();
    const lista: string[] = [];
    if (total > 0) {
      const fijos = totalDeGastos(this.gastos().filter((movement) => !!movement.recurring));
      lista.push(t('reports.insights.variableShare', { percent: Math.round(((total - fijos) / total) * 100) }));
    } else {
      lista.push(t('reports.insights.noExpenses'));
    }
    const subida = this.mayorSubida();
    lista.push(
      subida
        ? t('reports.insights.categoryUp', { name: subida.nombre, percent: subida.porcentaje })
        : t('reports.insights.noCategoryUp'),
    );
    const sinCategoria = this.gastos().filter(
      (movement) => !movement.category || movement.category === t('movements.fallback.noCategory'),
    ).length;
    lista.push(
      sinCategoria
        ? t('reports.insights.uncategorized', { count: sinCategoria })
        : t('reports.insights.allCategorized'),
    );
    return lista;
  });

  private mayorSubida(): { nombre: string; porcentaje: number } | null {
    const periodos = this.periodos();
    if (periodos.length < 2) return null;
    const [anterior, actual] = periodos.slice(-2);
    const porMes = (mes: string) => {
      const totales = new Map<string, number>();
      for (const movement of this.gastos().filter((m) => m.date.startsWith(mes)))
        totales.set(movement.category, (totales.get(movement.category) ?? 0) + montoDeGasto(movement));
      return totales;
    };
    const antes = porMes(anterior);
    let mejor: { nombre: string; porcentaje: number } | null = null;
    for (const [nombre, valor] of porMes(actual)) {
      const previo = antes.get(nombre) ?? 0;
      if (previo <= 0 || valor <= previo) continue;
      const porcentaje = Math.round(((valor - previo) / previo) * 100);
      if (!mejor || porcentaje > mejor.porcentaje) mejor = { nombre, porcentaje };
    }
    return mejor;
  }

  exportReport(): void {
    const SALTO = '\r\n';
    if (!this.can(P.reportes.exportar)) return;
    const meses = toCsv(this.reportSeries(), [
      { header: this.i18n.t('reports.csv.month'), value: (fila) => fila.month },
      { header: this.i18n.t('reports.csv.income'), value: (fila) => fila.income },
      { header: this.i18n.t('reports.csv.expense'), value: (fila) => fila.expense },
      { header: this.i18n.t('reports.csv.net'), value: (fila) => fila.net },
    ]);
    const categorias = toCsv(this.reportCategories(), [
      { header: this.i18n.t('reports.csv.category'), value: (fila) => fila.name },
      { header: this.i18n.t('reports.csv.expense'), value: (fila) => fila.value },
      { header: this.i18n.t('reports.csv.percentage'), value: (fila) => fila.percent },
    ]);
    const periodo = this.i18n.t('reports.csv.periodRow', { months: this.reportPeriod() });
    downloadCsv(`finanzas-reporte-${this.reportPeriod()}m.csv`, [periodo, '', meses, '', categorias].join(SALTO));
    this.store.toast.set(this.i18n.t('reports.exportToast'));
  }
}
