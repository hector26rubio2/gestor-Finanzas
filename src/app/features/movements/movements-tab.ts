import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
import { MovementsBookService } from '../../shared/movements/movements-book.service';

@Component({
  selector: 'app-movements-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, KpiComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements-tab.html',
  styleUrl: '../../pages/workspace.css',
})
export class MovementsTabComponent implements AfterViewInit {
  readonly store = inject(DemoStore);
  readonly book = inject(MovementsBookService);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly route = inject(ActivatedRoute);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly periodOptions: readonly UiOption[] = [
    { value: 'all', label: 'Últimos 12 meses' },
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' },
    { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-05', label: 'Mayo 2026' },
  ];
  readonly movementAccountOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas las cuentas' },
    ...this.store.data().accounts.map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly movementCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas' },
    ...this.book.movementCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly movementOperationOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Gastos / compras' },
    { value: 'transfer', label: 'Transferencias' },
    { value: 'loan', label: 'Préstamos y créditos' },
    { value: 'recurring', label: 'Recurrentes' },
  ];
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
        this.book.movementColumns.map((columna) => ({
          header: columna.label,
          value: (fila: Record<string, unknown>) => fila[columna.key],
        })),
      ),
    );
    this.store.toast.set(`${filas.length} movimientos exportados.`);
  }
}
