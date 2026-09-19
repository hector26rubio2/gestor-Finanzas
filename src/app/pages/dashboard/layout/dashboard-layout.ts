export interface LayoutRow {
  readonly key: string;
  readonly ids: readonly string[];
  readonly sizes: number[];
  readonly height: number;
}

export interface LayoutItem {
  readonly id: string;
  readonly height: number;
  readonly alone?: boolean;
}

export const MIN_ROW_HEIGHT = 120;
export const MAX_ROW_HEIGHT = 1100;
export const MIN_PANEL_SIZE = 12;
export const ROW_HEIGHT_STEP = 10;

const TOTAL = 100;

export function clampHeight(height: number): number {
  const stepped = Math.round(height / ROW_HEIGHT_STEP) * ROW_HEIGHT_STEP;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, stepped));
}

export function equalSizes(count: number): number[] {
  return count > 0 ? Array.from({ length: count }, () => TOTAL / count) : [];
}

export function normalizeSizes(sizes: readonly number[]): number[] {
  const positive = sizes.map((size) => (Number.isFinite(size) && size > 0 ? size : 0));
  const sum = positive.reduce((total, size) => total + size, 0);
  return sum > 0 ? positive.map((size) => (size / sum) * TOTAL) : equalSizes(sizes.length);
}

function rowOf(ids: readonly string[], sizes: readonly number[], height: number): LayoutRow {
  return { key: ids[0], ids, sizes: normalizeSizes(sizes), height: clampHeight(height) };
}

export function buildRows(items: readonly LayoutItem[], perRow: number): LayoutRow[] {
  const rows: LayoutRow[] = [];
  let current: LayoutItem[] = [];
  const flush = () => {
    if (!current.length) return;
    rows.push(
      rowOf(
        current.map((item) => item.id),
        equalSizes(current.length),
        Math.max(...current.map((item) => item.height)),
      ),
    );
    current = [];
  };
  for (const item of items) {
    if (item.alone) {
      flush();
      current = [item];
      flush();
      continue;
    }
    current.push(item);
    if (current.length === perRow) flush();
  }
  flush();
  return rows;
}

export function reconcileRows(
  rows: readonly LayoutRow[],
  items: readonly LayoutItem[],
  perRow: number,
): readonly LayoutRow[] {
  if (!rows.length) return buildRows(items, perRow);
  const wanted = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const kept: LayoutRow[] = [];
  for (const row of rows) {
    const indexes = row.ids.map((id, index) => (wanted.has(id) && !seen.has(id) ? index : -1)).filter((i) => i >= 0);
    indexes.forEach((index) => seen.add(row.ids[index]));
    if (!indexes.length) continue;
    if (indexes.length === row.ids.length) {
      kept.push(row);
      continue;
    }
    kept.push(
      rowOf(
        indexes.map((index) => row.ids[index]),
        indexes.map((index) => row.sizes[index]),
        row.height,
      ),
    );
  }
  const additions = items.filter((item) => !seen.has(item.id));
  const result = [...kept];
  for (const item of additions) {
    const last = result[result.length - 1];
    const lastAlone = last ? last.ids.some((id) => wanted.get(id)?.alone) : true;
    if (last && !item.alone && !lastAlone && last.ids.length < perRow) {
      const share = TOTAL / (last.ids.length + 1);
      const scaled = last.sizes.map((size) => (size / TOTAL) * (TOTAL - share));
      result[result.length - 1] = rowOf([...last.ids, item.id], [...scaled, share], Math.max(last.height, item.height));
    } else {
      result.push(rowOf([item.id], [TOTAL], item.height));
    }
  }
  return sameRows(result, rows) ? rows : result;
}

function sameRows(a: readonly LayoutRow[], b: readonly LayoutRow[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (row, index) =>
        row.height === b[index].height &&
        row.ids.length === b[index].ids.length &&
        row.ids.every((id, position) => id === b[index].ids[position]) &&
        row.sizes.every((size, position) => Math.abs(size - b[index].sizes[position]) < 1e-6),
    )
  );
}

export function withSizes(rows: readonly LayoutRow[], key: string, sizes: readonly number[]): readonly LayoutRow[] {
  return rows.map((row) =>
    row.key === key && sizes.length === row.ids.length ? { ...row, sizes: normalizeSizes(sizes) } : row,
  );
}

export function withHeight(rows: readonly LayoutRow[], key: string, height: number): readonly LayoutRow[] {
  return rows.map((row) => (row.key === key ? { ...row, height: clampHeight(height) } : row));
}

function locate(rows: readonly LayoutRow[], id: string): { row: number; position: number } | null {
  for (let row = 0; row < rows.length; row++) {
    const position = rows[row].ids.indexOf(id);
    if (position >= 0) return { row, position };
  }
  return null;
}

function removeFrom(row: LayoutRow, position: number): LayoutRow | null {
  const ids = row.ids.filter((_, index) => index !== position);
  if (!ids.length) return null;
  return rowOf(
    ids,
    row.sizes.filter((_, index) => index !== position),
    row.height,
  );
}

export function joinPreviousRow(rows: readonly LayoutRow[], id: string): readonly LayoutRow[] {
  const found = locate(rows, id);
  if (!found || found.row === 0) return rows;
  const source = rows[found.row];
  const target = rows[found.row - 1];
  const share = TOTAL / (target.ids.length + 1);
  const merged = rowOf(
    [...target.ids, id],
    [...target.sizes.map((size) => (size / TOTAL) * (TOTAL - share)), share],
    Math.max(target.height, source.height),
  );
  const rest = removeFrom(source, found.position);
  return rows.flatMap((row, index) =>
    index === found.row - 1 ? [merged] : index === found.row ? (rest ? [rest] : []) : [row],
  );
}

export function splitOut(rows: readonly LayoutRow[], id: string): readonly LayoutRow[] {
  const found = locate(rows, id);
  if (!found || rows[found.row].ids.length < 2) return rows;
  const source = rows[found.row];
  const rest = removeFrom(source, found.position) as LayoutRow;
  const own = rowOf([id], [TOTAL], source.height);
  return rows.flatMap((row, index) => (index === found.row ? [rest, own] : [row]));
}

export function swapAdjacent(rows: readonly LayoutRow[], id: string, direction: number): readonly LayoutRow[] {
  const flat = rows.flatMap((row) => row.ids);
  const index = flat.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= flat.length) return rows;
  const swapped = [...flat];
  [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
  let cursor = 0;
  return rows.map((row) => {
    const ids = swapped.slice(cursor, cursor + row.ids.length);
    cursor += row.ids.length;
    return { ...row, key: ids[0], ids };
  });
}

export function canJoinPrevious(rows: readonly LayoutRow[], id: string): boolean {
  const found = locate(rows, id);
  return !!found && found.row > 0;
}

export function canSplit(rows: readonly LayoutRow[], id: string): boolean {
  const found = locate(rows, id);
  return !!found && rows[found.row].ids.length > 1;
}
