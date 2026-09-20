import { IconComponent } from '../../ui/icon/icon';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { toCsv, downloadCsv } from '../../core/utils/csv';
import { KpiGridComponent } from '../../ui/kpi-grid/kpi-grid';
import { TableZoneComponent } from '../../ui/table-zone/table-zone';
import { TAB_PAGE_HOST_CLASS } from '../../shared/tab-page-layout';
import { DataTableComponent } from '../../ui/data-table/data-table';
import { SkeletonComponent } from '../../ui/skeleton/skeleton';
import { KpiComponent } from '../../ui/kpi/kpi';
import { longestInstallmentDebt, recurringExpenseCount, topSpendingCategory } from './movement-insights';
import { UiOption, UiSelectComponent } from '../../ui/select/select';
import { P } from '../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../core/state/store';
import { I18nService } from '../../core/i18n';
import { MovementsBookService } from '../../shared/movements/movements-book.service';
import { HeaderActionsService } from '../../shared/header-actions.service';

@Component({
  selector: 'app-movements-tab',
  imports: [
    IconComponent,
    CommonModule,
    FormsModule,
    HlmButton,
    HlmInput,
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
  readonly recurringExpenses = computed(() => recurringExpenseCount(this.store.movements()));
  readonly longestDebt = computed(() => longestInstallmentDebt(this.store.data().movements));
  readonly topCategory = computed(() => topSpendingCategory(this.store.movements()));
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  /** El boton de exportar de la cabecera compartida delega aqui mientras esta pestaña esta activa. */
  ngOnInit(): void {
    this.headerActions.exportMovements.set(() => this.exportMovements());
  }
  ngOnDestroy(): void {
    this.headerActions.exportMovements.set(null);
  }

  readonly periodOptions = computed<readonly UiOption[]>(() => {
    const formatter = new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'long', year: 'numeric' });
    const label = (year: number, month: number) => {
      const text = formatter.format(new Date(year, month, 1, 12));
      return text.charAt(0).toLocaleUpperCase() + text.slice(1);
    };
    const now = new Date();
    const months: UiOption[] = Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: label(date.getFullYear(), date.getMonth()),
      };
    });
    const selected = this.store.period();
    if (selected !== 'all' && !months.some((option) => option.value === selected)) {
      const [year, month] = selected.split('-').map(Number);
      months.push({ value: selected, label: label(year, month - 1) });
    }
    return [{ value: 'all', label: this.i18n.t('movements.filters.period.all') }, ...months];
  });
  readonly movementAccountOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.account.all') },
    ...this.store.data().accounts.map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly movementCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.category.all') },
    ...this.book.movementCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly movementOperationOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.operation.all') },
    { value: 'income', label: this.i18n.t('movements.filters.operation.income') },
    { value: 'expense', label: this.i18n.t('movements.filters.operation.expense') },
    { value: 'transfer', label: this.i18n.t('movements.filters.operation.transfer') },
    { value: 'advance', label: this.i18n.t('movements.filters.operation.advance') },
    { value: 'loan', label: this.i18n.t('movements.filters.operation.loan') },
    { value: 'recurring', label: this.i18n.t('movements.filters.operation.recurring') },
  ]);
  /** En pantallas estrechas los filtros arrancan plegados: primero el dinero. */
  readonly filtersOpen = signal(typeof window === 'undefined' || window.innerWidth > 700);
  readonly activeFilterCount = computed(
    () =>
      [
        this.store.query() !== '',
        this.store.period() !== 'all',
        this.store.accountFilter() !== 'all',
        this.book.movementAccountType() !== 'all',
        this.book.movementCategory() !== 'all',
        this.book.movementOperation() !== 'all',
      ].filter(Boolean).length,
  );
  /** El boton de restablecer solo aparece cuando hay algo que restablecer. */
  readonly hasActiveFilters = computed(
    () =>
      this.store.query() !== '' ||
      this.store.period() !== 'all' ||
      this.store.accountFilter() !== 'all' ||
      this.book.movementAccountType() !== 'all' ||
      this.book.movementCategory() !== 'all' ||
      this.book.movementOperation() !== 'all',
  );

  ngAfterViewInit(): void {
    if (this.route.snapshot.queryParamMap.get('focus') === 'search')
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  loadMovementPage(page: number): void {
    void this.book.loadMovementPage(page);
  }
  changeMovementPageSize(size: number): void {
    this.book.changeMovementPageSize(size);
  }
  clearFilters(): void {
    this.store.query.set('');
    this.store.period.set('all');
    this.store.accountFilter.set('all');
    this.book.movementAccountType.set('all');
    this.book.movementCategory.set('all');
    this.book.movementOperation.set('all');
    void this.book.loadMovementPage(1);
  }
  /** Exporta los movimientos que hay a la vista, con los filtros aplicados. */
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
    this.store.toast.set(`${filas.length} movimientos exportados.`);
  }
}
