import {
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  EventEmitter,
  Output,
  QueryList,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTableImports } from '@spartan-ng/helm/table';
import {
  ColumnDef,
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  injectTable,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/angular-table';
import { I18nService } from '../../core/i18n';
import { sincronizarPaginaConLaUrl } from '../../core/state/url-state';
import { IconComponent, IconName } from '../icon/icon';
import { SearchFieldComponent } from '../search-field/search-field';
import { UiOption, UiSelectComponent } from '../select/select';
import { FinTableCellDirective } from './table-cell.directive';

export interface TableColumn {
  key: string;
  label: string;
  essential?: boolean;
  sortable?: boolean;
  sortKey?: string;
  facet?: boolean;
  hideable?: boolean;
}

type Row = Record<string, any>;

interface SearchQuery {
  field: string;
  text: string;
}

const SELECT_COLUMN = '__select';
const ALL_FIELDS = '__all';

const searchFilter = (
  row: { getAllCells: () => { column: { id: string } }[]; getValue: (id: string) => unknown },
  _id: string,
  query: SearchQuery | undefined,
): boolean => {
  const needle = query?.text.trim().toLowerCase();
  if (!needle) return true;
  const ids =
    query!.field === ALL_FIELDS
      ? row
          .getAllCells()
          .map((cell) => cell.column.id)
          .filter((id) => id !== SELECT_COLUMN)
      : [query!.field];
  return ids.some((id) =>
    String(row.getValue(id) ?? '')
      .toLowerCase()
      .includes(needle),
  );
};

const oneOfFilter = (
  row: { getValue: (id: string) => unknown },
  id: string,
  allowed: readonly string[] | undefined,
): boolean => !allowed?.length || allowed.includes(String(row.getValue(id) ?? ''));
oneOfFilter.autoRemove = (value: readonly string[] | undefined) => !value?.length;

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  columnFacetingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
  filterFns: { includesString: filterFn_includesString, oneOf: oneOfFilter, search: searchFilter },
});

@Component({
  selector: 'fin-table',
  imports: [
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  host: {
    class:
      'flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card text-foreground max-[520px]:max-w-full max-[520px]:overflow-visible',
  },
})
export class DataTableComponent {
  readonly i18n = inject(I18nService);
  @ContentChildren(FinTableCellDirective) private cellTemplates!: QueryList<FinTableCellDirective>;
  cellTemplate(key: string) {
    return this.cellTemplates?.find((t) => t.column === key)?.template ?? null;
  }
  private static nextId = 0;
  readonly rangeId = `table-range-${DataTableComponent.nextId++}`;
  readonly tableLabel = input(this.i18n.t('table.defaultLabel'));
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<Row[]>([]);
  readonly pageSize = input(10);
  readonly totalRows = input<number | null>(null);
  readonly remotePage = input(1);
  readonly selectable = input(true);
  readonly multiSelect = input(false);
  readonly toolbar = input<boolean | null>(null);
  readonly showFooter = input(true);
  readonly urlKey = input<string | null>(null);
  @Output() readonly rowSelected = new EventEmitter<Row>();
  @Output() readonly selectionChange = new EventEmitter<Row[]>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();
  @Output() readonly pageChange = new EventEmitter<number>();

  readonly page = signal(0);
  private readonly selectedSize = signal<number | null>(null);
  readonly searchField = signal(ALL_FIELDS);
  readonly searchText = signal('');

  readonly remote = computed(() => this.totalRows() !== null);
  readonly size = computed(() => Math.max(1, this.selectedSize() ?? this.pageSize()));
  readonly hasDetailColumns = computed(() => this.columns().some((c) => c.essential === false));
  readonly showToolbar = computed(() => this.toolbar() ?? (this.showFooter() && !this.remote()));

  private readonly columnDefs = computed<ColumnDef<typeof features, Row>[]>(() => {
    const remote = this.remote();
    const defs: ColumnDef<typeof features, Row>[] = this.columns().map((column) => ({
      id: column.key,
      accessorFn: (row: Row) => row[column.sortKey ?? column.key],
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
    features,
    columns: this.columnDefs(),
    data: this.rows(),
    manualPagination: this.remote(),
    rowCount: this.totalRows() ?? undefined,
    autoResetPageIndex: false,
    globalFilterFn: 'search',
    enableGlobalFilter: !this.remote(),
    getRowId: (row: Row, index: number) => String(row['id'] ?? index),
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
    { value: ALL_FIELDS, label: this.i18n.t('table.search.allFields') },
    ...this.columns().map((column) => ({ value: column.key, label: column.label })),
  ]);
  readonly hasFilters = computed(
    () =>
      this.searchText().trim() !== '' ||
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

  setSearchField(field: string): void {
    this.searchField.set(field);
    this.applySearch();
  }

  private applySearch(): void {
    const text = this.searchText();
    this.table.setGlobalFilter(text.trim() ? ({ field: this.searchField(), text } satisfies SearchQuery) : undefined);
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
    this.table.setGlobalFilter(undefined);
    this.table.resetColumnFilters(true);
    this.page.set(0);
  }

  sortIcon(direction: false | 'asc' | 'desc'): IconName {
    if (direction === 'asc') return 'sortAscending';
    if (direction === 'desc') return 'sortDescending';
    return 'sortNone';
  }

  ariaSort(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
    if (direction === 'asc') return 'ascending';
    if (direction === 'desc') return 'descending';
    return 'none';
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
    if (column.essential !== false) return '';
    return this.isRowExpanded(rowIndex) ? 'max-[520px]:grid' : 'max-[520px]:hidden';
  }

  columnOf(key: string): TableColumn | undefined {
    return this.columns().find((column) => column.key === key);
  }

  display(value: unknown): string {
    return value == null ? '—' : String(value);
  }
}
