import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppStore } from '../../../core/state/store';
import {
  LayoutItem,
  LayoutRow,
  joinPreviousRow,
  reconcileRows,
  splitOut,
  swapAdjacent,
  withHeight,
  withSizes,
} from './dashboard-layout';

interface StoredLayout {
  readonly version: 1;
  readonly widgets: readonly LayoutRow[];
  readonly kpis: readonly LayoutRow[];
}

const EMPTY: StoredLayout = { version: 1, widgets: [], kpis: [] };
const WIDGETS_PER_ROW = 2;
const KPIS_PER_ROW = 4;

function isRow(value: unknown): value is LayoutRow {
  const row = value as LayoutRow;
  return (
    !!row &&
    typeof row.key === 'string' &&
    Array.isArray(row.ids) &&
    Array.isArray(row.sizes) &&
    row.ids.length === row.sizes.length &&
    typeof row.height === 'number'
  );
}

function read(key: string): StoredLayout {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed.version !== 1 || !parsed.widgets?.every(isRow) || !parsed.kpis?.every(isRow)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

function write(key: string, value: StoredLayout): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

@Injectable()
export class DashboardLayoutService {
  private readonly store = inject(AppStore);
  private readonly storageKey = computed(() => `finanzas.dashboard.layout.v1.${this.store.user()?.id ?? 'anon'}`);

  private readonly stored = signal<StoredLayout>(read(this.storageKey()));
  readonly widgetItems = signal<readonly LayoutItem[]>([]);
  readonly kpiItems = signal<readonly LayoutItem[]>([]);

  readonly widgetRows = computed(() => reconcileRows(this.stored().widgets, this.widgetItems(), WIDGETS_PER_ROW));
  readonly kpiRows = computed(() => reconcileRows(this.stored().kpis, this.kpiItems(), KPIS_PER_ROW));
  readonly customized = computed(() => this.stored().widgets.length > 0 || this.stored().kpis.length > 0);

  constructor() {
    effect(() => {
      const key = this.storageKey();
      untracked(() => this.stored.set(read(key)));
    });
  }

  resizeWidgets(key: string, sizes: readonly number[]): void {
    this.commitWidgets(withSizes(this.widgetRows(), key, sizes));
  }

  resizeWidgetRow(key: string, height: number): void {
    this.commitWidgets(withHeight(this.widgetRows(), key, height));
  }

  resizeKpis(key: string, sizes: readonly number[]): void {
    this.commitKpis(withSizes(this.kpiRows(), key, sizes));
  }

  joinPrevious(id: string): void {
    this.commitWidgets(joinPreviousRow(this.widgetRows(), id));
  }

  splitFromRow(id: string): void {
    this.commitWidgets(splitOut(this.widgetRows(), id));
  }

  moveWidget(id: string, direction: number): void {
    this.commitWidgets(swapAdjacent(this.widgetRows(), id, direction));
  }

  reset(): void {
    this.stored.set(EMPTY);
    write(this.storageKey(), EMPTY);
  }

  private commitWidgets(widgets: readonly LayoutRow[]): void {
    this.commit({ ...this.stored(), widgets, kpis: this.kpiRows() });
  }

  private commitKpis(kpis: readonly LayoutRow[]): void {
    this.commit({ ...this.stored(), kpis, widgets: this.widgetRows() });
  }

  private commit(next: StoredLayout): void {
    this.stored.set(next);
    write(this.storageKey(), next);
  }
}
