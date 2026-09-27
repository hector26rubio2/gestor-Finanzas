export interface FlowItem {
  readonly id: string;
  readonly cols: number;
  readonly height: number;
}

export interface FlowDefault {
  readonly id: string;
  readonly cols: number;
  readonly height: number;
}

export const GRID_COLUMNS = 12;
export const MIN_COLS = 2;
export const WIDGET_MIN_COLS = 3;
export const KPI_MIN_COLS = 2;
export const GRID_GAP = 20;
export const ROW_UNIT = 10;
export const MIN_ROW_HEIGHT = 100;
export const MAX_ROW_HEIGHT = 1100;
export const ROW_HEIGHT_STEP = 10;

export function clampCols(cols: number, min = MIN_COLS): number {
  return Math.min(GRID_COLUMNS, Math.max(min, Math.round(cols)));
}

export function clampHeight(height: number): number {
  const stepped = Math.round(height / ROW_HEIGHT_STEP) * ROW_HEIGHT_STEP;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, stepped));
}

export function reconcileFlow(items: readonly FlowItem[], defaults: readonly FlowDefault[]): readonly FlowItem[] {
  if (!items.length) return defaults.map((item) => ({ ...item }));
  const wanted = new Map(defaults.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const kept: FlowItem[] = [];
  for (const item of items) {
    if (!wanted.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    kept.push(item);
  }
  const additions = defaults.filter((item) => !seen.has(item.id)).map((item) => ({ ...item }));
  const result = [...kept, ...additions];
  return result.length === items.length && result.every((item, index) => item === items[index]) ? items : result;
}

function replaceItem(items: readonly FlowItem[], id: string, patch: Partial<FlowItem>): readonly FlowItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const current = items[index];
  const next = { ...current, ...patch };
  if (next.cols === current.cols && next.height === current.height) return items;
  return items.map((item, position) => (position === index ? next : item));
}

export function withCols(items: readonly FlowItem[], id: string, cols: number, min = MIN_COLS): readonly FlowItem[] {
  return replaceItem(items, id, { cols: clampCols(cols, min) });
}

export function withHeight(items: readonly FlowItem[], id: string, height: number): readonly FlowItem[] {
  return replaceItem(items, id, { height: clampHeight(height) });
}

export function moveItem(items: readonly FlowItem[], from: number, to: number): readonly FlowItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function swapAdjacent(items: readonly FlowItem[], id: string, direction: number): readonly FlowItem[] {
  const index = items.findIndex((item) => item.id === id);
  return moveItem(items, index, index + direction);
}

export function colsFromWidth(width: number, containerWidth: number, gap: number): number {
  const column = (containerWidth + gap) / GRID_COLUMNS;
  return (width + gap) / column;
}

export function rowSpan(height: number): number {
  return Math.ceil(height / ROW_UNIT) + GRID_GAP / ROW_UNIT;
}
