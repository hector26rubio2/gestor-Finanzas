import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { DashboardsApi } from '@core/api/dashboards.api';
import { RUNTIME_CONFIG } from '@core/session';
import { DashboardLayoutService, type KpiDefinition } from './dashboard-layout.service';

const widgets = [
  { id: 'a', cols: 6, height: 360 },
  { id: 'b', cols: 6, height: 360 },
  { id: 'c', cols: 12, height: 300 },
];

const kpis = [
  { id: 'k1', cols: 3, height: 120 },
  { id: 'k2', cols: 3, height: 120 },
];

function abrir() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      { provide: DashboardsApi, useValue: { update: vi.fn(() => of({})) } },
      {
        provide: FinanceApiClient,
        useValue: { session: vi.fn(() => of(null)), saveDashboardLayout: vi.fn(() => of({})) },
      },
    ],
  });
  const layout = TestBed.inject(DashboardLayoutService);
  layout.widgetDefaults.set(widgets);
  layout.kpiDefaults.set(kpis);
  return layout;
}

const orden = (flujo: readonly { id: string }[]) => flujo.map((i) => i.id);

describe('personalizar el dashboard: cada acción guarda y sobrevive a recargar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('sin tocar nada el diseño no cuenta como personalizado', () => {
    const layout = abrir();

    expect(layout.customized()).toBe(false);
    expect(orden(layout.widgetFlow())).toEqual(['a', 'b', 'c']);
  });

  it('mover un widget cambia el orden y se recuerda al recargar', () => {
    abrir().moveWidget('a', 1);

    const recargado = abrir();

    expect(orden(recargado.widgetFlow())).toEqual(['b', 'a', 'c']);
    expect(recargado.customized()).toBe(true);
  });

  it('arrastrar un widget a otra posición se recuerda', () => {
    abrir().dropWidget(0, 2);

    expect(orden(abrir().widgetFlow())).toEqual(['b', 'c', 'a']);
  });

  it('mover un KPI de la franja de arriba se recuerda sin tocar los widgets', () => {
    abrir().moveKpi('k1', 1);

    const recargado = abrir();

    expect(orden(recargado.kpiFlow())).toEqual(['k2', 'k1']);
    expect(orden(recargado.widgetFlow())).toEqual(['a', 'b', 'c']);
  });

  it('cambiar el ancho y el alto de un widget se recuerda y no toca a los demás', () => {
    abrir().resizeWidget('b', { cols: 4, height: 500 });

    const recargado = abrir();

    expect(recargado.widgetFlow().find((w) => w.id === 'b')).toMatchObject({ cols: 4, height: 500 });
    expect(recargado.widgetFlow().find((w) => w.id === 'a')).toMatchObject({ cols: 6, height: 360 });
  });

  it('ocultar widgets se recuerda y mostrarlos de nuevo también', () => {
    abrir().saveHiddenWidgets(['b']);
    expect(abrir().hiddenWidgets()).toEqual(['b']);

    abrir().saveHiddenWidgets([]);
    expect(abrir().hiddenWidgets()).toEqual([]);
  });

  it('el tipo y la métrica de un widget se recuerdan', () => {
    const configs = [{ id: 'a', type: 'bar', measure: 'expense', dimension: 'category' }];
    abrir().saveWidgetConfigs(configs as never);

    expect(abrir().widgetConfigs()).toEqual(configs);
  });

  it('los KPI creados o editados a mano se recuerdan', () => {
    const definiciones: KpiDefinition[] = [{ id: 'k-a', label: 'Mi gasto', formula: 'expense' }];
    abrir().saveDefinitions(definiciones);

    expect(abrir().definitions()).toEqual(definiciones);
  });

  it('los rangos de un KPI se guardan y volver al valor por defecto los quita', () => {
    const rangos = { warnAt: 20, badAt: 40, higherIsWorse: true };
    abrir().saveRanges('k1', rangos);
    expect(abrir().ranges()).toEqual({ k1: rangos });

    abrir().saveRanges('k1', undefined);
    expect(abrir().ranges()).toEqual({});
  });

  it('restablecer devuelve el orden por defecto y lo borra al recargar', () => {
    const layout = abrir();
    layout.moveWidget('a', 1);
    layout.saveHiddenWidgets(['c']);

    layout.reset();
    const recargado = abrir();

    expect(orden(recargado.widgetFlow())).toEqual(['a', 'b', 'c']);
    expect(recargado.hiddenWidgets()).toEqual([]);
    expect(recargado.customized()).toBe(false);
  });

  it('un diseño compartido es de solo lectura y no cambia nada', () => {
    const layout = abrir();
    layout.usarDiseno({ tipo: 'compartido', id: 'x', nombre: 'Del equipo' } as never, null);

    layout.moveWidget('a', 1);
    layout.saveHiddenWidgets(['b']);

    expect(layout.soloLectura()).toBe(true);
    expect(orden(layout.widgetFlow())).toEqual(['a', 'b', 'c']);
    expect(layout.hiddenWidgets()).toEqual([]);
  });

  it('personalizar un diseño propio no cambia el principal', () => {
    const principal = abrir();
    principal.usarDiseno({ tipo: 'propio', id: 'p', nombre: 'Mío', fijado: false } as never, null);
    principal.moveWidget('a', 1);

    principal.usarDiseno({ tipo: 'principal' });

    expect(orden(principal.widgetFlow())).toEqual(['a', 'b', 'c']);
  });

  it('un diseño guardado dañado en el navegador se ignora y vuelve el de fábrica', () => {
    abrir().moveWidget('a', 1);
    const clave = Object.keys(localStorage).find((k) => k.startsWith('finanzas.dashboard.layout'));
    localStorage.setItem(clave!, '{roto');

    expect(orden(abrir().widgetFlow())).toEqual(['a', 'b', 'c']);
  });
});
