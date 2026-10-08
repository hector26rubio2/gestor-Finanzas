import { Component, computed, effect, inject, input, signal, untracked, output, contentChildren } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { ColumnDef, injectTable } from '@tanstack/angular-table';
import { I18nService } from '@core/i18n';
import { sincronizarPaginaConLaUrl } from '@core/routing/url-state';
import { IconComponent, IconName } from '@ui/icon/icon';
import { SearchFieldComponent } from '@ui/search-field/search-field';
import { DateFieldComponent } from '@ui/date-field/date-field';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { FinTableCellDirective } from './table-cell.directive';
import {
  ariaDeOrden,
  fechaFijada,
  filtrarPorFijados,
  iconoDeOrden,
  mostrarValor,
  SELECT_COLUMN,
  SortDirection,
  TABLE_ALL_FIELDS,
  TableColumn,
  TableFilter,
  TableRow,
  TableSearchQuery,
  tableFeaturesConfig,
  valoresConocidos,
} from './data-table.model';

@Component({
  selector: 'fin-table',
  imports: [
    HlmAutocompleteImports,
    DateFieldComponent,
    FormsModule,
    NgTemplateOutlet,
    HlmBadgeImports,
    HlmButton,
    HlmCheckbox,
    HlmDropdownMenuImports,
    HlmTableImports,
    IconComponent,
    SearchFieldComponent,
    UiSelectComponent,
  ],
  templateUrl: './data-table.html',
  host: {
    class:
      'flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card text-foreground max-[520px]:max-w-full max-[520px]:overflow-visible',
  },
})
export class DataTableComponent {
  readonly i18n = inject(I18nService);
  private readonly cellTemplates = contentChildren(FinTableCellDirective);
  cellTemplate(key: string) {
    return this.cellTemplates()?.find((t) => t.column() === key)?.template ?? null;
  }
  private static nextId = 0;
  readonly rangeId = `table-range-${DataTableComponent.nextId++}`;
  readonly tableLabel = input(this.i18n.t('table.defaultLabel'));
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<TableRow[]>([]);
  readonly pageSize = input(10);
  readonly totalRows = input<number | null>(null);
  readonly remotePage = input(1);
  readonly selectable = input(true);
  readonly multiSelect = input(false);
  readonly toolbar = input<boolean | null>(null);
  readonly showFooter = input(true);
  readonly urlKey = input<string | null>(null);
  readonly rowSelected = output<TableRow>();
  readonly selectionChange = output<TableRow[]>();
  readonly pageSizeChange = output<number>();
  readonly pageChange = output<number>();
  readonly pinnedChange = output<readonly TableFilter[]>();

  readonly page = signal(0);
  private readonly selectedSize = signal<number | null>(null);
  readonly searchField = signal(TABLE_ALL_FIELDS);
  readonly searchText = signal('');
  readonly pinned = signal<readonly TableFilter[]>([]);
  private pinnedId = 0;
  private readonly pinnedRows = computed(() =>
    !this.pinned().length || this.remote()
      ? this.rows()
      : filtrarPorFijados(this.rows(), this.pinned(), this.columns()),
  );

  readonly remote = computed(() => this.totalRows() !== null);
  readonly size = computed(() => Math.max(1, this.selectedSize() ?? this.pageSize()));
  readonly hasDetailColumns = computed(() => this.columns().some((c) => c.essential === false));
  readonly showToolbar = computed(() => this.toolbar() ?? (this.showFooter() && !this.remote()));

  private readonly columnDefs = computed<ColumnDef<typeof tableFeaturesConfig, TableRow>[]>(() => {
    const remote = this.remote();
    const defs: ColumnDef<typeof tableFeaturesConfig, TableRow>[] = this.columns().map((column) => ({
      id: column.key,
      accessorFn: (row: TableRow) => row[column.sortKey ?? column.key],
      header: column.label,
      enableSorting: !remote && column.sortable !== false,
      enableHiding: column.hideable !== false,
      enableColumnFilter: !remote && !!column.facet,
      filterFn: 'oneOf',
      sortFn: 'alphanumeric',
    }));
    if (this.multiSelect()) {
      defs.unshift({
        id: SELECT_COLUMN,
        header: '',
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
      });
    }
    return defs;
  });

  readonly table = injectTable(() => ({
    features: tableFeaturesConfig,
    columns: this.columnDefs(),
    data: this.pinnedRows(),
    manualPagination: this.remote(),
    rowCount: this.totalRows() ?? undefined,
    autoResetPageIndex: false,
    globalFilterFn: 'search',
    enableGlobalFilter: !this.remote(),
    getRowId: (row: TableRow, index: number) => String(row['id'] ?? index),
    state: {
      pagination: {
        pageIndex: this.remote() ? Math.max(0, this.remotePage() - 1) : this.page(),
        pageSize: this.size(),
      },
    },
    onPaginationChange: (updater: unknown) => {
      const current = { pageIndex: this.currentPage(), pageSize: this.size() };
      const next =
        typeof updater === 'function'
          ? (updater as (value: typeof current) => typeof current)(current)
          : (updater as typeof current);
      if (next.pageSize !== current.pageSize) this.setSizeValue(String(next.pageSize));
      else this.setPage(next.pageIndex);
    },
  }));

  readonly totalCount = computed(() =>
    this.remote() ? this.totalRows()! : this.table.getPrePaginatedRowModel().rows.length,
  );
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.size())));
  readonly currentPage = computed(() =>
    Math.min(this.remote() ? Math.max(0, this.remotePage() - 1) : this.page(), this.pageCount() - 1),
  );
  readonly start = computed(() => (this.totalCount() ? this.currentPage() * this.size() + 1 : 0));
  readonly end = computed(() => Math.min((this.currentPage() + 1) * this.size(), this.totalCount()));
  readonly visibleRows = computed(() => this.table.getRowModel().rows);
  readonly visibleHeaders = computed(() => this.table.getHeaderGroups()[0]?.headers ?? []);
  readonly selectedCount = computed(() => this.table.getSelectedRowModel().rows.length);
  readonly facetColumns = computed(() => this.columns().filter((column) => column.facet && !this.remote()));
  readonly hideableColumns = computed(() =>
    this.table.getAllLeafColumns().filter((column) => column.id !== SELECT_COLUMN && column.getCanHide()),
  );
  readonly fieldOptions = computed<readonly UiOption[]>(() => [
    { value: TABLE_ALL_FIELDS, label: this.i18n.t('table.search.allFields') },
    ...this.columns().map((column) => ({ value: column.key, label: column.label })),
  ]);
  readonly hasFilters = computed(
    () =>
      this.searchText().trim() !== '' ||
      this.pinned().length > 0 ||
      this.facetColumns().some(
        (column) => (this.table.getColumn(column.key)?.getFilterValue() as unknown[] | undefined)?.length,
      ),
  );
  readonly pageSelectOptions = computed<readonly UiOption[]>(() =>
    Array.from({ length: this.pageCount() }, (_, index) => ({
      value: index.toString(),
      label: (index + 1).toString(),
    })),
  );
  readonly sizeOptions = computed<readonly UiOption[]>(() =>
    [...new Set([5, 10, 25, 50, 100, this.size()])]
      .sort((a, b) => a - b)
      .map((value) => ({ value: String(value), label: String(value) })),
  );

  private readonly expandedRows = signal<ReadonlySet<number>>(new Set());

  constructor() {
    if (inject(Router, { optional: true })) {
      sincronizarPaginaConLaUrl(() => this.urlKey(), this.page);
    }
    let visibilityApplied = false;
    effect(() => {
      const columns = this.columns();
      untracked(() => {
        if (visibilityApplied || !columns.length) return;
        visibilityApplied = true;
        const hidden = columns.filter((column) => column.hidden);
        if (hidden.length)
          this.table.setColumnVisibility(Object.fromEntries(hidden.map((column) => [column.key, false])));
      });
    });
    let primerCalculo = true;
    effect(() => {
      this.totalCount();
      if (primerCalculo) {
        primerCalculo = false;
        return;
      }
      if (!untracked(this.remote) && untracked(this.page) !== 0) this.page.set(0);
    });
  }

  isRowExpanded(index: number): boolean {
    return this.expandedRows().has(index);
  }

  toggleRow(index: number): void {
    this.expandedRows.update((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  setSearchText(text: string): void {
    this.searchText.set(text);
    this.applySearch();
  }

  readonly searchColumn = computed(() => this.columnOf(this.searchField()) ?? null);
  readonly searchIsDate = computed(() => this.searchColumn()?.filter === 'date');
  private readonly knownValues = computed(() => valoresConocidos(this.rows(), this.searchColumn()));
  readonly suggestible = computed(() => this.knownValues().length > 0);
  readonly suggestions = computed(() => {
    const buscado = this.searchText().trim().toLocaleLowerCase();
    const fijados = new Set(
      this.pinned()
        .filter((filtro) => filtro.field === this.searchField())
        .map((filtro) => filtro.value),
    );
    return this.knownValues()
      .filter((valor) => !fijados.has(valor) && (!buscado || valor.toLocaleLowerCase().includes(buscado)))
      .slice(0, 12);
  });

  pinSearch(): void {
    this.pin(this.searchText());
  }

  pin(value: string | null | undefined): void {
    const text = String(value ?? '').trim();
    const field = this.searchField();
    if (!text || this.pinned().some((filtro) => filtro.field === field && filtro.value === text)) return;
    this.pinned.update((lista) => [...lista, { id: `p${++this.pinnedId}`, field, value: text }]);
    this.setSearchText('');
    this.pinnedChange.emit(this.pinned());
  }

  pinnedText(filtro: TableFilter): string {
    return this.columnOf(filtro.field)?.filter === 'date' ? fechaFijada(filtro.value) : filtro.value;
  }

  unpin(id: string): void {
    this.pinned.update((lista) => lista.filter((condicion) => condicion.id !== id));
    this.page.set(0);
    this.pinnedChange.emit(this.pinned());
  }

  pinnedLabel(field: string): string {
    if (field === TABLE_ALL_FIELDS) return this.i18n.t('table.search.allFields');
    return this.columns().find((column) => column.key === field)?.label ?? field;
  }

  setSearchField(field: string): void {
    this.searchField.set(field);
    this.applySearch();
  }

  private applySearch(): void {
    const text = this.searchText();
    this.table.setGlobalFilter(
      text.trim() ? ({ field: this.searchField(), text } satisfies TableSearchQuery) : undefined,
    );
    this.page.set(0);
  }

  facetValues(key: string): readonly { value: string; count: number }[] {
    const column = this.table.getColumn(key);
    if (!column) return [];
    return [...column.getFacetedUniqueValues().entries()]
      .filter(([value]) => value !== null && value !== undefined && value !== '')
      .map(([value, count]) => ({ value: String(value), count }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  }

  facetSelection(key: string): readonly string[] {
    return (this.table.getColumn(key)?.getFilterValue() as string[] | undefined) ?? [];
  }

  toggleFacet(key: string, value: string): void {
    const current = this.facetSelection(key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    this.table.getColumn(key)?.setFilterValue(next.length ? next : undefined);
    this.page.set(0);
  }

  clearFilters(): void {
    this.searchText.set('');
    if (this.pinned().length) {
      this.pinned.set([]);
      this.pinnedChange.emit([]);
    }
    this.table.setGlobalFilter(undefined);
    this.table.resetColumnFilters(true);
    this.page.set(0);
  }

  sortIcon(direction: SortDirection): IconName {
    return iconoDeOrden(direction);
  }

  ariaSort(direction: SortDirection): 'ascending' | 'descending' | 'none' {
    return ariaDeOrden(direction);
  }

  toggleRowSelection(row: { toggleSelected: (value?: boolean) => void }, checked: boolean): void {
    row.toggleSelected(checked);
    this.emitSelection();
  }

  toggleAllRows(checked: boolean): void {
    this.table.toggleAllPageRowsSelected(checked);
    this.emitSelection();
  }

  private emitSelection(): void {
    this.selectionChange.emit(this.table.getSelectedRowModel().rows.map((row) => row.original));
  }

  setSizeValue(value: string): void {
    const size = Number(value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
    if (this.remote()) this.pageChange.emit(1);
  }

  setPage(zeroBasedPage: number): void {
    const next = Math.max(0, Math.min(zeroBasedPage, this.pageCount() - 1));
    if (this.remote()) this.pageChange.emit(next + 1);
    else this.page.set(next);
  }

  setPageValue(value: string): void {
    this.setPage(Number(value));
  }

  detailClass(column: TableColumn, rowIndex: number): string {
    const ajuste = column.wrap ? 'max-w-[28rem] min-w-48 whitespace-normal [overflow-wrap:anywhere]' : '';
    if (column.essential !== false) return ajuste;
    return `${ajuste} ${this.isRowExpanded(rowIndex) ? 'max-[520px]:grid' : 'max-[520px]:hidden'}`;
  }

  textoRecortado(column: TableColumn | undefined): boolean {
    return !!column?.wrap;
  }

  columnOf(key: string): TableColumn | undefined {
    return this.columns().find((column) => column.key === key);
  }

  display(value: unknown): string {
    return mostrarValor(value);
  }
}
