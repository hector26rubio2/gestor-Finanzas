import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppStore } from '../../../core/state/store';
import {
  FlowDefault,
  FlowItem,
  KPI_MIN_COLS,
  WIDGET_MIN_COLS,
  moveItem,
  reconcileFlow,
  swapAdjacent,
  withCols,
  withHeight,
} from './dashboard-layout';

export interface FlowResize {
  readonly cols?: number;
  readonly height?: number;
}

interface StoredLayout {
  readonly version: 2;
  readonly widgets: readonly FlowItem[];
  readonly kpis: readonly FlowItem[];
}

const EMPTY: StoredLayout = { version: 2, widgets: [], kpis: [] };

function isFlowItem(value: unknown): value is FlowItem {
  const item = value as FlowItem;
  return (
    !!item &&
    typeof item.id === 'string' &&
    Number.isFinite(item.cols) &&
    Number.isFinite(item.height) &&
    item.cols >= 1 &&
    item.cols <= 12
  );
}

function read(key: string): StoredLayout {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed.version !== 2 || !parsed.widgets?.every(isFlowItem) || !parsed.kpis?.every(isFlowItem)) return EMPTY;
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
  private readonly storageKey = computed(() => `finanzas.dashboard.layout.v2.${this.store.user()?.id ?? 'anon'}`);

  private readonly stored = signal<StoredLayout>(read(this.storageKey()));
  readonly widgetDefaults = signal<readonly FlowDefault[]>([]);
  readonly kpiDefaults = signal<readonly FlowDefault[]>([]);

  readonly widgetFlow = computed(() => reconcileFlow(this.stored().widgets, this.widgetDefaults()));
  readonly kpiFlow = computed(() => reconcileFlow(this.stored().kpis, this.kpiDefaults()));
  readonly customized = computed(() => this.stored().widgets.length > 0 || this.stored().kpis.length > 0);

  constructor() {
    effect(() => {
      const key = this.storageKey();
      untracked(() => this.stored.set(read(key)));
    });
  }

  resizeWidget(id: string, change: FlowResize): void {
    let next = this.widgetFlow();
    if (change.cols !== undefined) next = withCols(next, id, change.cols, WIDGET_MIN_COLS);
    if (change.height !== undefined) next = withHeight(next, id, change.height);
    this.commitWidgets(next);
  }

  resizeKpi(id: string, change: FlowResize): void {
    let next = this.kpiFlow();
    if (change.cols !== undefined) next = withCols(next, id, change.cols, KPI_MIN_COLS);
    if (change.height !== undefined) next = withHeight(next, id, change.height);
    this.commitKpis(next);
  }

  dropWidget(from: number, to: number): void {
    this.commitWidgets(moveItem(this.widgetFlow(), from, to));
  }

  dropKpi(from: number, to: number): void {
    this.commitKpis(moveItem(this.kpiFlow(), from, to));
  }

  moveWidget(id: string, direction: number): void {
    this.commitWidgets(swapAdjacent(this.widgetFlow(), id, direction));
  }

  moveKpi(id: string, direction: number): void {
    this.commitKpis(swapAdjacent(this.kpiFlow(), id, direction));
  }

  reset(): void {
    this.stored.set(EMPTY);
    write(this.storageKey(), EMPTY);
  }

  private commitWidgets(widgets: readonly FlowItem[]): void {
    if (widgets === this.widgetFlow()) return;
    this.commit({ version: 2, widgets, kpis: this.kpiFlow() });
  }

  private commitKpis(kpis: readonly FlowItem[]): void {
    if (kpis === this.kpiFlow()) return;
    this.commit({ version: 2, widgets: this.widgetFlow(), kpis });
  }

  private commit(next: StoredLayout): void {
    this.stored.set(next);
    write(this.storageKey(), next);
  }
}
