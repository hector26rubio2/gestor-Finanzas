import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiDashboard, FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { DashboardComponent } from './dashboard';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';

describe('DashboardComponent y las cifras del servidor', () => {
  const dinero = (amount: string) => ({ amount, currency: 'COP' });
  const dashboard: ApiDashboard = {
    period: {
      income: dinero('9000000'),
      expense: dinero('3500000'),
      net: dinero('5500000'),
      period: { start: '2026-08-01', end: '2026-08-31' },
    },
    accounts: [],
    cards: [],
    topCategories: [],
    series: [
      { date: '2026-08-01', income: dinero('6000000'), expense: dinero('2000000'), net: dinero('4000000') },
      { date: '2026-08-02', income: dinero('3000000'), expense: dinero('1500000'), net: dinero('1500000') },
    ],
    asOf: '2026-08-31',
  };

  function montar(api: Partial<FinanceApiClient> = {}) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: RUNTIME_CONFIG,
          useValue: { apiBaseUrl: 'https://api.example.test' },
        },
        { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(dashboard)), ...api } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.dashboard.ver, P.dashboard.tabla.ver] });
    return TestBed.createComponent(DashboardComponent);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('pide el dashboard al servidor con el rango del periodo activo', async () => {
    const api = { dashboard: vi.fn(() => of(dashboard)) };
    const fixture = montar(api as Partial<FinanceApiClient>);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.dashboard).toHaveBeenCalled();
    const [desde, hasta] = api.dashboard.mock.calls[0] as unknown as [string, string];
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('un filtro local devuelve el cálculo a la pantalla, porque el servidor no lo conoce', async () => {
    const fixture = montar();
    fixture.detectChanges();
    await fixture.whenStable();
    const componente = fixture.componentInstance;

    componente.datos.remote.set(dashboard);
    componente.accountId.set('cuenta-1');
    fixture.detectChanges();

    expect(componente.income()).not.toBe(9000000);
  });
});
