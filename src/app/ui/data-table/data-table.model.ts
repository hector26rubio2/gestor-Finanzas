import {
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
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/angular-table';
import { IconName } from '@ui/icon/icon';

export interface TableColumn {
  key: string;
  label: string;
  essential?: boolean;
  sortable?: boolean;
  sortKey?: string;
  facet?: boolean;
  hideable?: boolean;
  hidden?: boolean;
  filter?: 'date';
  rawKey?: string;
  options?: readonly string[];
  wrap?: boolean;
}

export type TableRow = Record<string, any>;

export interface TableFilter {
  id: string;
  field: string;
  value: string;
}

export interface TableSearchQuery {
  field: string;
  text: string;
}

export type SortDirection = false | 'asc' | 'desc';

export const SELECT_COLUMN = '__select';
export const TABLE_ALL_FIELDS = '__all';

const searchFilter = (
  row: { getAllCells: () => { column: { id: string } }[]; getValue: (id: string) => unknown },
  _id: string,
  query: TableSearchQuery | undefined,
): boolean => {
  const needle = query?.text.trim().toLowerCase();
  if (!query || !needle) return true;
  const ids =
    query.field === TABLE_ALL_FIELDS
      ? row
          .getAllCells()
          .map((cell) => cell.column.id)
          .filter((id) => id !== SELECT_COLUMN)
      : [query.field];
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

export const tableFeaturesConfig = tableFeatures({
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

export function filtrarPorFijados(
  rows: readonly TableRow[],
  fijados: readonly TableFilter[],
  columns: readonly TableColumn[],
): TableRow[] {
  const porCampo = new Map<string, string[]>();
  for (const condicion of fijados)
    porCampo.set(condicion.field, [...(porCampo.get(condicion.field) ?? []), condicion.value.toLocaleLowerCase()]);
  const claves = columns.map((column) => column.key);
  const texto = (row: TableRow, clave: string) => String(row[clave] ?? '').toLocaleLowerCase();
  const coincide = (row: TableRow, campo: string, valor: string) => {
    const columna = columns.find((column) => column.key === campo);
    if (columna?.filter === 'date') return texto(row, columna.rawKey ?? campo).startsWith(valor);
    return texto(row, campo).includes(valor);
  };
  return rows.filter((row) =>
    [...porCampo.entries()].every(([campo, valores]) =>
      valores.some((valor) =>
        campo === TABLE_ALL_FIELDS
          ? claves.some((clave) => texto(row, clave).includes(valor))
          : coincide(row, campo, valor),
      ),
    ),
  );
}

export function valoresConocidos(rows: readonly TableRow[], column: TableColumn | null): readonly string[] {
  if (!column || column.filter === 'date') return [];
  if (column.options) return column.options;
  const valores = [...new Set(rows.map((row) => mostrarValor(row[column.key])).filter(Boolean))];
  return valores.length <= 40 ? valores.sort((a, b) => a.localeCompare(b)) : [];
}

export function fechaFijada(valor: string): string {
  const fecha = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(fecha);
}

export function iconoDeOrden(direction: SortDirection): IconName {
  if (direction === 'asc') return 'sortAscending';
  if (direction === 'desc') return 'sortDescending';
  return 'sortNone';
}

export function ariaDeOrden(direction: SortDirection): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

export function mostrarValor(value: unknown): string {
  return value == null ? '—' : String(value);
}
