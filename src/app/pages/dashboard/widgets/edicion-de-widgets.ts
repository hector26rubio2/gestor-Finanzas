import { computed, effect, inject, signal, untracked } from '@angular/core';
import { CAPABILITIES } from '@core/state';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { DashboardLayoutService, WidgetGuardado } from '@shared/tablero/dashboard-layout.service';
import { Dimension, GENERIC_TYPES, Measure, Widget, WidgetType } from '@shared/tablero/dashboard.model';
import { buildWidgetCatalog } from '@pages/dashboard/dashboard-widget-catalog';

const CAMPOS_EDITABLES = [
  'type',
  'wide',
  'dimension',
  'dimension2',
  'measure',
  'variant',
  'granularity',
  'limit',
  'goalMin',
  'goalTarget',
  'goalMax',
] as const;

function fusionarWidgets(catalogo: Widget[], guardados: readonly WidgetGuardado[]): Widget[] {
  const porId = new Map(guardados.map((guardado) => [guardado.id, guardado]));
  const base = catalogo.map((widget) => {
    const cambios = porId.get(widget.id);
    return cambios ? ({ ...widget, ...cambios, title: widget.title, kicker: widget.kicker } as Widget) : widget;
  });
  const propios = guardados
    .filter((guardado) => guardado.custom && typeof guardado.title === 'string' && typeof guardado['type'] === 'string')
    .map((guardado) => {
      const { custom, ...widget } = guardado;
      void custom;
      return widget as unknown as Widget;
    });
  return [...base, ...propios];
}

export function esGenerico(type: WidgetType): boolean {
  return (GENERIC_TYPES as readonly WidgetType[]).includes(type);
}

export class EdicionDeWidgets {
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);
  private readonly layout = inject(DashboardLayoutService);

  readonly all = signal<Widget[]>(buildWidgetCatalog(this.i18n));
  readonly hiddenIds = signal<string[]>([]);
  private readonly restaurar = effect(() => {
    const guardados = this.layout.widgetConfigs();
    untracked(() => this.all.set(fusionarWidgets(buildWidgetCatalog(this.i18n), guardados ?? [])));
  });

  readonly visibles = computed(() => this.all().filter((w) => !this.hiddenIds().includes(w.id) && this.canSee(w)));
  readonly ocultos = computed(() => this.all().filter((w) => this.hiddenIds().includes(w.id) && this.canSee(w)));

  canSee(widget: Widget): boolean {
    return this.caps.allows(widget.capability ?? P.dashboard.widget.propios);
  }

  hide(id: string): void {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => [...x, id]);
  }

  show(id: string): void {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => x.filter((v) => v !== id));
  }

  move(id: string, direction: number): void {
    if (!this.caps.allows(P.dashboard.widget.orden.editar)) return;
    this.all.update((items) => {
      const next = [...items],
        index = next.findIndex((item) => item.id === id),
        target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    this.guardar();
  }

  changeType(id: string, type: string): void {
    this.editar(id, (item) => {
      const nextType = type as WidgetType;
      return esGenerico(nextType) && !item.dimension
        ? { ...item, type: nextType, dimension: 'category', measure: item.measure ?? 'expense' }
        : { ...item, type: nextType };
    });
  }

  changeDimension(id: string, dimension: string): void {
    this.editar(id, (item) => ({ ...item, dimension: dimension as Dimension }));
  }

  changeDimension2(id: string, dimension2: string): void {
    this.editar(id, (item) => ({ ...item, dimension2: dimension2 as Dimension }));
  }

  changeMeasure(id: string, measure: string): void {
    this.editar(id, (item) => ({ ...item, measure: measure as Measure }));
  }

  changeWidgetField(id: string, field: 'variant' | 'granularity', value: string | undefined): void {
    this.editar(id, (item) => ({ ...item, [field]: value }));
  }

  changeGoal(id: string, field: 'goalMin' | 'goalTarget' | 'goalMax', value: string): void {
    const numero = Number(value);
    if (Number.isNaN(numero)) return;
    this.editar(id, (item) => ({ ...item, [field]: numero }));
  }

  agregar(widget: Widget): void {
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    this.all.update((items) => [...items, widget]);
    this.guardar();
  }

  private editar(id: string, cambio: (item: Widget) => Widget): void {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? cambio(item) : item)));
    this.guardar();
  }

  private guardar(): void {
    const catalogo = new Map(buildWidgetCatalog(this.i18n).map((widget) => [widget.id, widget]));
    const configs = this.all().flatMap((widget): WidgetGuardado[] => {
      const original = catalogo.get(widget.id);
      if (!original) return [{ ...widget, custom: true }];
      const cambios = Object.fromEntries(
        CAMPOS_EDITABLES.filter((campo) => widget[campo] !== original[campo]).map((campo) => [campo, widget[campo]]),
      );
      return Object.keys(cambios).length ? [{ id: widget.id, ...cambios }] : [];
    });
    this.layout.saveWidgetConfigs(configs);
  }
}
