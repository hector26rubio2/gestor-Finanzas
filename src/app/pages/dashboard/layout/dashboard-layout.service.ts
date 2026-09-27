import type { ConfiguracionVisual } from '@shared/graficas';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';
import { FinanceApiClient, DashboardsApi } from '@core/api';
import { AppStore } from '@core/state';
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
import { Dimension, KpiFormula } from '../dashboard.model';
import { KpiRanges, esRangoValido } from '../kpis/kpi-ranges';

export interface FlowResize {
  readonly cols?: number;
  readonly height?: number;
}

export interface KpiFilter {
  readonly dimension: Dimension;
  readonly value: string;
}

export interface KpiDefinition {
  readonly id: string;
  readonly label: string;
  readonly formula: KpiFormula;
  readonly filter?: KpiFilter;
}

interface StoredLayout {
  readonly version: 2;
  readonly widgets: readonly FlowItem[];
  readonly kpis: readonly FlowItem[];
  readonly definitions?: readonly KpiDefinition[];
  readonly ranges?: Readonly<Record<string, KpiRanges | null>>;
  readonly configs?: readonly WidgetGuardado[];
  readonly reports?: readonly VistaDeReporte[];
}

export interface WidgetGuardado {
  readonly id: string;
  readonly title?: string;
  readonly kicker?: string;
  readonly custom?: boolean;
  readonly [campo: string]: unknown;
}

export interface VistaDeReporte {
  readonly id: string;
  readonly title: string;
  readonly config: ConfiguracionVisual;
  readonly wide: boolean;
}

const esConfigValida = (valor: unknown): boolean =>
  valor === undefined ||
  (Array.isArray(valor) && valor.every((item) => !!item && typeof (item as { id?: unknown }).id === 'string'));

const EMPTY: StoredLayout = { version: 2, widgets: [], kpis: [] };

function isDefinition(value: unknown): value is KpiDefinition {
  const item = value as KpiDefinition;
  return !!item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.formula === 'string';
}

function rangosValidos(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((rango) => rango === null || esRangoValido(rango));
}

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

function parse(raw: string | null | undefined): StoredLayout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed.version !== 2 || !parsed.widgets?.every(isFlowItem) || !parsed.kpis?.every(isFlowItem)) return null;
    if (parsed.definitions !== undefined && !parsed.definitions.every(isDefinition)) return null;
    if (!rangosValidos(parsed.ranges)) return null;
    if (!esConfigValida(parsed.configs) || !esConfigValida(parsed.reports)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function read(key: string): StoredLayout {
  try {
    return parse(localStorage.getItem(key)) ?? EMPTY;
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

const SAVE_DELAY_MS = 800;

export type DestinoDelDiseno =
  | { readonly tipo: 'principal' }
  | { readonly tipo: 'propio'; readonly id: string; readonly nombre: string; readonly fijado: boolean }
  | { readonly tipo: 'compartido'; readonly id: string };

@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly tablerosApi = inject(DashboardsApi);
  private hydratedKey: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private guardadoPendiente: (() => void) | null = null;
  readonly destino = signal<DestinoDelDiseno>({ tipo: 'principal' });
  readonly soloLectura = computed(() => this.destino().tipo === 'compartido');
  readonly esPrincipal = computed(() => this.destino().tipo === 'principal');
  private readonly storageKey = computed(() => `finanzas.dashboard.layout.v2.${this.store.user()?.id ?? 'anon'}`);

  private readonly stored = signal<StoredLayout>(read(this.storageKey()));
  readonly widgetDefaults = signal<readonly FlowDefault[]>([]);
  readonly kpiDefaults = signal<readonly FlowDefault[]>([]);

  readonly widgetFlow = computed(() => reconcileFlow(this.stored().widgets, this.widgetDefaults()));
  readonly kpiFlow = computed(() => reconcileFlow(this.stored().kpis, this.kpiDefaults()));
  readonly customized = computed(
    () =>
      this.stored().widgets.length > 0 ||
      this.stored().kpis.length > 0 ||
      this.stored().definitions !== undefined ||
      this.stored().configs !== undefined ||
      Object.keys(this.stored().ranges ?? {}).length > 0,
  );
  readonly definitions = computed(() => this.stored().definitions ?? null);
  readonly ranges = computed(() => this.stored().ranges ?? {});
  readonly widgetConfigs = computed(() => this.stored().configs ?? null);
  readonly reportViews = computed(() => this.stored().reports ?? null);

  saveWidgetConfigs(configs: readonly WidgetGuardado[]): void {
    this.commit({ ...this.stored(), configs });
  }

  saveReportViews(reports: readonly VistaDeReporte[]): void {
    this.commit({ ...this.stored(), reports });
  }

  constructor() {
    effect(() => {
      const key = this.storageKey();
      untracked(() => {
        if (this.hydratedKey !== key) this.stored.set(read(key));
      });
    });
  }

  usarDiseno(destino: DestinoDelDiseno, layoutJson?: string | null): void {
    this.guardarYa();
    this.destino.set(destino);
    this.stored.set(destino.tipo === 'principal' ? read(this.storageKey()) : (parse(layoutJson) ?? EMPTY));
  }

  renombrarDestino(nombre: string, fijado: boolean): void {
    const actual = this.destino();
    if (actual.tipo === 'propio') this.destino.set({ ...actual, nombre, fijado });
  }

  disenoActualJson(): string | null {
    const actual = this.stored();
    return actual === EMPTY ? null : JSON.stringify(actual);
  }

  hydrate(json: string | null | undefined): void {
    if (this.saveTimer) return;
    const key = this.storageKey();
    const remote = parse(json);
    this.hydratedKey = key;
    if (!this.esPrincipal()) {
      if (remote) write(key, remote);
      return;
    }
    if (remote) {
      this.stored.set(remote);
      write(key, remote);
      return;
    }
    const local = read(key);
    this.stored.set(local);
    if (local !== EMPTY) this.scheduleSave(local);
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
    this.commit(EMPTY);
  }

  saveDefinitions(definitions: readonly KpiDefinition[]): void {
    this.commit({ ...this.stored(), definitions });
  }

  saveRanges(id: string, rangos: KpiRanges | null | undefined): void {
    const resto: Record<string, KpiRanges | null> = { ...(this.stored().ranges ?? {}) };
    if (rangos === undefined) delete resto[id];
    else resto[id] = rangos;
    this.commit({ ...this.stored(), ranges: resto });
  }

  private commitWidgets(widgets: readonly FlowItem[]): void {
    if (widgets === this.widgetFlow()) return;
    this.commit({ ...this.stored(), version: 2, widgets, kpis: this.kpiFlow() });
  }

  private commitKpis(kpis: readonly FlowItem[]): void {
    if (kpis === this.kpiFlow()) return;
    this.commit({ ...this.stored(), version: 2, widgets: this.widgetFlow(), kpis });
  }

  private commit(next: StoredLayout): void {
    if (this.soloLectura()) return;
    this.stored.set(next);
    if (this.esPrincipal()) write(this.storageKey(), next);
    this.scheduleSave(next);
  }

  private guardarYa(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const pendiente = this.guardadoPendiente;
    this.guardadoPendiente = null;
    pendiente?.();
  }

  private scheduleSave(layout: StoredLayout): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const destino = this.destino();
    const json = layout === EMPTY ? null : JSON.stringify(layout);
    this.guardadoPendiente = () => {
      const peticion: Observable<unknown> | null =
        destino.tipo === 'propio'
          ? this.tablerosApi.update(destino.id, { name: destino.nombre, layoutJson: json, isPinned: destino.fijado })
          : destino.tipo === 'principal'
            ? this.api.saveDashboardLayout(json)
            : null;
      if (peticion) void firstValueFrom(peticion).catch(() => undefined);
    };
    this.saveTimer = setTimeout(() => this.guardarYa(), SAVE_DELAY_MS);
  }
}
