import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../../../core/api/api-client';
import { RUNTIME_CONFIG } from '../../../core/session/runtime';
import { AppStore } from '../../../core/state/store';
import { DashboardLayoutService } from './dashboard-layout.service';

const defaults = [
  { id: 'a', cols: 6, height: 360 },
  { id: 'b', cols: 6, height: 360 },
];

describe('diseño del dashboard guardado en el servidor', () => {
  let save: ReturnType<typeof vi.fn>;

  function montar() {
    save = vi.fn(() => of({}));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)), saveDashboardLayout: save } },
      ],
    });
    const layout = TestBed.inject(DashboardLayoutService);
    layout.widgetDefaults.set(defaults);
    return layout;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('un cambio se guarda una sola vez tras la pausa', () => {
    const layout = montar();
    layout.resizeWidget('a', { cols: 4 });
    layout.resizeWidget('a', { cols: 5 });
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.mock.calls[0][0]).widgets[0]).toEqual({ id: 'a', cols: 5, height: 360 });
  });

  it('el diseño que llega del servidor reemplaza al local', () => {
    const layout = montar();
    const remote = {
      version: 2,
      widgets: [
        { id: 'b', cols: 12, height: 200 },
        { id: 'a', cols: 3, height: 300 },
      ],
      kpis: [],
    };

    layout.hydrate(JSON.stringify(remote));

    expect(layout.widgetFlow().map((item) => item.id)).toEqual(['b', 'a']);
    expect(layout.widgetFlow()[0].cols).toBe(12);
    expect(save).not.toHaveBeenCalled();
  });

  it('si el servidor no tiene diseño se sube el que había en este navegador', () => {
    const layout = montar();
    const key = `finanzas.dashboard.layout.v2.${TestBed.inject(AppStore).user()?.id ?? 'anon'}`;
    localStorage.setItem(key, JSON.stringify({ version: 2, widgets: [{ id: 'a', cols: 4, height: 300 }], kpis: [] }));

    layout.hydrate(null);
    vi.advanceTimersByTime(1000);

    expect(layout.widgetFlow()[0].cols).toBe(4);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('un diseño roto del servidor se ignora y restablecer lo borra allá', () => {
    const layout = montar();
    layout.hydrate('{"version":9}');
    expect(layout.customized()).toBe(false);

    layout.resizeWidget('a', { cols: 4 });
    layout.reset();
    vi.advanceTimersByTime(1000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(null);
  });

  it('una carga que llega con un guardado pendiente no pisa el cambio local', () => {
    const layout = montar();
    layout.resizeWidget('a', { cols: 4 });

    layout.hydrate(JSON.stringify({ version: 2, widgets: [{ id: 'a', cols: 12, height: 360 }], kpis: [] }));

    expect(layout.widgetFlow()[0].cols).toBe(4);
  });
});
