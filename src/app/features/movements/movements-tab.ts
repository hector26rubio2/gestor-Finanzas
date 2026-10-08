import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toCsv, downloadCsv, sumBy, addDaysToIso, addMonthsToIso } from '@core/utils';
import { KpiGridComponent } from '@ui/kpi-grid';
import { TableZoneComponent } from '@ui/table-zone';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { DataTableComponent } from '@ui/data-table';
import { SkeletonComponent } from '@ui/skeleton';
import { KpiComponent } from '@ui/kpi';
import { longestInstallmentDebt, recurringExpenseCount, topSpendingCategory } from './movement-insights';
import { UiOption, UiSelectComponent } from '@ui/select';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import type { Movement } from '@core/state';
import { monthRange } from '@core/api';
import {
  PERIODOS_DE_HISTORIA,
  Rango,
  crearHistoriaDeFlujo,
  crearMovimientosDelPeriodo,
  rangosMensuales,
  variacion,
} from '@shared/historia';
import { MovementsBookService } from '@shared/movements';
import { HeaderActionsService } from '@shared/header-actions.service';

export type MovementsKpi = 'income' | 'expense' | 'records' | 'recurring' | 'installments' | 'topCategory';

export function movementsKpiHintKey(kpi: MovementsKpi): string {
  return `movements.kpi.page.${kpi}.hint`;
}

const DIAS_MAXIMOS_DEL_RESUMEN = 3650;

@Component({
  selector: 'app-movements-tab',
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    KpiComponent,
    KpiGridComponent,
    TableZoneComponent,
    UiSelectComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
})
export class MovementsTabComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(AppStore);
  readonly book = inject(MovementsBookService);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly route = inject(ActivatedRoute);
  private readonly headerActions = inject(HeaderActionsService);
  readonly P = P;
  private readonly rangoDeIndicadores = computed<Rango>(() => {
    const periodo = this.store.period();
    const hoy = this.store.hoy();
    return periodo === 'all' ? { start: addMonthsToIso(hoy, -12), end: hoy } : monthRange(periodo);
  });
  private readonly delPeriodo = crearMovimientosDelPeriodo(this.rangoDeIndicadores);
  private readonly movimientosDeIndicadores = computed(() => {
    const cuenta = this.store.accountFilter();
    return this.delPeriodo.movimientos().filter((movimiento) => cuenta === 'all' || movimiento.accountId === cuenta);
  });
  readonly recurringExpenses = computed(() => recurringExpenseCount(this.movimientosDeIndicadores()));
  readonly longestDebt = computed(() => longestInstallmentDebt(this.movimientosDeIndicadores()));
  readonly topCategory = computed(() => topSpendingCategory(this.movimientosDeIndicadores()));
  private readonly rangos = computed(() => rangosMensuales(PERIODOS_DE_HISTORIA, this.store.hoy()));
  private readonly historia = crearHistoriaDeFlujo(this.rangos);
  private readonly rangoDelPeriodo = computed(() => {
    const periodo = this.store.period();
    const hoy = this.store.hoy();
    return [
      periodo === 'all' ? { start: addDaysToIso(hoy, -DIAS_MAXIMOS_DEL_RESUMEN), end: hoy } : monthRange(periodo),
    ];
  });
  private readonly totalDelPeriodo = crearHistoriaDeFlujo(this.rangoDelPeriodo);
  readonly totalesDelServidor = computed(() => {
    const sinFiltros = this.store.accountFilter() === 'all' && !this.book.pinned().length;
    const punto = this.totalDelPeriodo()[0];
    return sinFiltros && punto && !punto.movs ? punto : null;
  });
  readonly ingresosMostrados = computed(() => this.totalesDelServidor()?.income ?? this.store.income());
  readonly gastosMostrados = computed(() => this.totalesDelServidor()?.expense ?? this.store.expense());
  readonly registrosMostrados = computed(() => this.store.remoteMovementTotal());
  readonly historiaEtiqueta = computed(() => this.i18n.t('kpi.history.month', { count: PERIODOS_DE_HISTORIA }));
  readonly variacion = variacion;
  private serieLocal(valor: (movs: readonly Movement[]) => number): number[] {
    const historia = this.historia();
    return historia.every((punto) => punto.movs) ? historia.map((punto) => valor(punto.movs ?? [])) : [];
  }
  readonly incomeSeries = computed(() => this.historia().map((punto) => punto.income));
  readonly expenseSeries = computed(() => this.historia().map((punto) => punto.expense));
  readonly recordsSeries = computed(() => this.serieLocal((movs) => movs.length));
  readonly recurringSeries = computed(() =>
    this.serieLocal((movs) => movs.filter((m) => !!m.recurring && m.kind === 'expense').length),
  );
  readonly installmentsSeries = computed(() =>
    this.serieLocal((movs) =>
      sumBy(
        movs.filter((m) => !!m.installmentTotal),
        (m) => Math.abs(m.amount),
      ),
    ),
  );
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  hintDe(kpi: MovementsKpi): string {
    if (this.totalesDelServidor() && (kpi === 'income' || kpi === 'expense')) return 'movements.kpi.selectionHint';
    if (kpi === 'records') return 'movements.kpi.selectionHint';
    return movementsKpiHintKey(kpi);
  }
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    this.headerActions.exportMovements.set(() => this.exportMovements());
  }
  ngOnDestroy(): void {
    this.headerActions.exportMovements.set(null);
    if (this.book.pinned().length) {
      this.book.pinned.set([]);
      void this.book.loadMovementPage(1);
    }
  }

  readonly periodYear = computed(() => (this.store.period() === 'all' ? 'all' : this.store.period().slice(0, 4)));
  readonly periodMonth = computed(() => this.store.period().slice(5, 7) || 'all');
  readonly yearOptions = computed<readonly UiOption[]>(() => {
    const actual = new Date().getFullYear();
    const conDatos = this.store
      .data()
      .movements.map((m) => Number(m.date.slice(0, 4)))
      .filter(Boolean);
    const primero = Math.min(actual - 10, ...conDatos);
    const anios = Array.from({ length: actual - primero + 1 }, (_, indice) => String(actual - indice));
    return [
      { value: 'all', label: this.i18n.t('movements.filters.period.allYears') },
      ...anios.map((anio) => ({ value: anio, label: anio })),
    ];
  });
  readonly monthOptions = computed<readonly UiOption[]>(() => {
    const formatter = new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'long' });
    const meses = Array.from({ length: 12 }, (_, indice) => {
      const texto = formatter.format(new Date(2000, indice, 1, 12));
      return {
        value: String(indice + 1).padStart(2, '0'),
        label: texto.charAt(0).toLocaleUpperCase() + texto.slice(1),
      };
    });
    return [{ value: 'all', label: this.i18n.t('movements.filters.period.wholeYear') }, ...meses];
  });

  setPeriodYear(anio: string): void {
    const mes = this.periodMonth();
    this.store.period.set(anio === 'all' ? 'all' : mes === 'all' ? anio : `${anio}-${mes}`);
    this.loadMovementPage(1);
  }

  setPeriodMonth(mes: string): void {
    const anio = this.periodYear();
    if (anio === 'all') return;
    this.store.period.set(mes === 'all' ? anio : `${anio}-${mes}`);
    this.loadMovementPage(1);
  }
  ngAfterViewInit(): void {
    if (this.route.snapshot.queryParamMap.get('focus') === 'search')
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>('[role=search] input')?.focus());
  }

  loadMovementPage(page: number): void {
    void this.book.loadMovementPage(page);
  }
  changeMovementPageSize(size: number): void {
    this.book.changeMovementPageSize(size);
  }
  exportMovements(): void {
    if (!this.can(P.movimientos.exportar)) return;
    const filas = this.book.movementRows();
    downloadCsv(
      `finanzas-movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        filas,
        this.book.movementColumns().map((columna) => ({
          header: columna.label,
          value: (fila: Record<string, unknown>) => fila[columna.key],
        })),
      ),
    );
    this.store.toast.set(this.i18n.t('movements.exportToast', { count: filas.length }));
  }
}
