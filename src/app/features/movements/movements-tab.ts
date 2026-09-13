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
import { toCsv, downloadCsv } from '../../core/csv';
import { DataTableComponent, KpiComponent } from '../../ui/ui';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';
import { MovementsBookService } from '../../shared/movements/movements-book.service';
import { HeaderActionsService } from '../../shared/header-actions.service';

@Component({
  selector: 'app-movements-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, KpiComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements-tab.html',
  styleUrl: './movements-tab.css',
})
export class MovementsTabComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(DemoStore);
  readonly book = inject(MovementsBookService);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly route = inject(ActivatedRoute);
  private readonly headerActions = inject(HeaderActionsService);
  readonly P = P;
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

  readonly periodOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.period.all') },
    { value: '2026-08', label: this.i18n.t('movements.filters.period.aug2026') },
    { value: '2026-07', label: this.i18n.t('movements.filters.period.jul2026') },
    { value: '2026-06', label: this.i18n.t('movements.filters.period.jun2026') },
    { value: '2026-05', label: this.i18n.t('movements.filters.period.may2026') },
  ]);
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
