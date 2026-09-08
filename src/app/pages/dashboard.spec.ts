import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiDashboard, FinanceApiClient } from '../core/api-client';
import { P } from '../core/permissions';
import { RUNTIME_CONFIG } from '../core/runtime';
import { DemoStore } from '../core/store';
import { DashboardComponent } from './dashboard';

/**
 * El contrato de `DashboardDto` dice que el cliente no suma importes por su cuenta. Estas
 * pruebas fijan que la pantalla usa las cifras del servidor cuando puede, y que sigue
 * calculando en local cuando el servidor no puede responder por ella.
 */
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

  function montar(mode: 'api' | 'demo', api: Partial<FinanceApiClient> = {}) {
    window.__FINANZAS_CONFIG__ = mode === 'api' ? { mode, apiBaseUrl: 'https://api.example.test' } : { mode };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: RUNTIME_CONFIG,
          useValue: mode === 'api' ? { mode, apiBaseUrl: 'https://api.example.test' } : { mode },
        },
        { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(dashboard)), ...api } },
      ],
    });
    const store = TestBed.inject(DemoStore);
    store.user.set({ ...store.users[0], capabilities: [P.dashboard.ver, P.dashboard.listar] });
    return TestBed.createComponent(DashboardComponent);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('pide el dashboard al servidor con el rango del periodo activo', async () => {
    const api = { dashboard: vi.fn(() => of(dashboard)) };
    const fixture = montar('api', api as Partial<FinanceApiClient>);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.dashboard).toHaveBeenCalled();
    const [desde, hasta] = api.dashboard.mock.calls[0] as unknown as [string, string];
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('en modo demo no llama al servidor y calcula en local', async () => {
    const api = { dashboard: vi.fn(() => of(dashboard)) };
    const fixture = montar('demo', api as Partial<FinanceApiClient>);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.dashboard).not.toHaveBeenCalled();
    expect(fixture.componentInstance.remote()).toBeNull();
  });

  it('un filtro local devuelve el cálculo a la pantalla, porque el servidor no lo conoce', async () => {
    const fixture = montar('api');
    fixture.detectChanges();
    await fixture.whenStable();
    const componente = fixture.componentInstance;

    // El servidor no sabe nada de «solo esta cuenta»: si mandara su cifra, el KPI no
    // respondería a lo que el usuario acaba de filtrar.
    componente.remote.set(dashboard);
    componente.accountId.set('cuenta-1');
    fixture.detectChanges();

    expect(componente.income()).not.toBe(9000000);
  });
});
