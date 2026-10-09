import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiWritesBus } from '@core/api/api-writes';
import { FinanceApiClient } from '@core/api/api-client';
import { AppStore } from '@core/state/store';
import { todayIso } from '@core/utils/dates';
import { RUNTIME_CONFIG } from './runtime';
import { SaldosService } from './saldos.service';

describe('SaldosService', () => {
  const tablero = {
    accounts: [{ account: { id: 'a1', name: 'Ahorros' }, balance: { amount: '900', currency: 'COP' } }],
    cards: [{ card: { id: 'c1', name: 'Visa' }, debt: { amount: '200', currency: 'COP' } }],
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function montar() {
    const dashboard = vi.fn(() => of(tablero));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: { dashboard } },
      ],
    });
    const store = TestBed.inject(AppStore);
    TestBed.inject(SaldosService);
    return { dashboard, store, escrituras: TestBed.inject(ApiWritesBus) };
  }

  it('al quedar lista la sesión no pide saldos: llegan con el arranque', async () => {
    const { dashboard, store } = montar();

    store.remoteState.set('ready');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(1000);

    expect(dashboard).not.toHaveBeenCalled();
  });

  it('tras una escritura refresca los saldos una sola vez', async () => {
    const { dashboard, store, escrituras } = montar();
    store.remoteState.set('ready');
    TestBed.tick();

    escrituras.notify();
    TestBed.tick();
    escrituras.notify();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(400);

    expect(dashboard).toHaveBeenCalledOnce();
    expect(dashboard).toHaveBeenCalledWith(todayIso(), todayIso());
    expect(store.saldosDelServidor()?.get('a1')).toBe(900);
    expect(store.saldosDelServidor()?.get('c1')).toBe(-200);
  });
});
