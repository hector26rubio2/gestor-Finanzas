import { MovementCommands } from '@core/state';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api/api-client';
import type { ApiMovement } from '@core/api/ledger.api';
import { I18nService } from '@core/i18n';
import { toMovement } from '@core/session/mappers';
import { EMPTY_KIND_CATALOG, MovementKind } from '@core/utils/movement-kinds';
import { AppStore } from './store';

function pata(id: string, flow: number, links: Record<string, string>): ApiMovement {
  return {
    id,
    date: '2026-09-25',
    kind: MovementKind.cardCashAdvance,
    effect: 0,
    flow,
    amount: {
      original: { amount: '300000', currency: 'COP' },
      base: { amount: '300000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    links,
    linkNames: {},
    origin: 0,
    description: 'Avance',
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
  };
}

describe('avance en efectivo', () => {
  afterEach(() => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  });

  it('se registra con la tarjeta como origen y queda fuera de ingresos y gastos', async () => {
    const createCashAdvance = vi.fn(() =>
      of({
        id: 'operacion-1',
        legs: [
          pata('pata-tarjeta', 2, { card: 'tarjeta-1', operation: 'operacion-1' }),
          pata('pata-cuenta', 1, { account: 'cuenta-1', operation: 'operacion-1' }),
        ],
      }),
    );
    const createTransfer = vi.fn();
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FinanceApiClient, useValue: { createCashAdvance, createTransfer } }],
    });
    const store = TestBed.inject(AppStore);
    store.data.update((data) => ({
      ...data,
      accounts: [
        { id: 'cuenta-1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 },
        { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5000000 },
      ],
      movements: [],
    }));

    await TestBed.inject(MovementCommands).save({
      kind: 'advance',
      date: '2026-09-25',
      description: 'Avance',
      accountId: 'tarjeta-1',
      targetId: 'cuenta-1',
      amount: 300000,
      category: '',
    });

    expect(createTransfer).not.toHaveBeenCalled();
    expect(createCashAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        card: 'tarjeta-1',
        account: 'cuenta-1',
        amount: { amount: '300000', currency: 'COP' },
      }),
    );
    const creados = store.data().movements;
    expect(creados).toHaveLength(2);
    expect(creados.every((movement) => movement.movementSubtype === 'advance')).toBe(true);
    expect(store.movements().filter((m) => m.kind === 'expense' && !m.movementSubtype)).toHaveLength(0);
  });

  it('el API lo devuelve como avance: la pata de la tarjeta resta y la de la cuenta suma', () => {
    const i18n = TestBed.inject(I18nService);
    const tarjeta = toMovement(i18n, EMPTY_KIND_CATALOG, pata('a', 2, { card: 'tarjeta-1' }));
    const cuenta = toMovement(i18n, EMPTY_KIND_CATALOG, pata('b', 1, { account: 'cuenta-1' }));

    expect(tarjeta).toMatchObject({
      accountId: 'tarjeta-1',
      kind: 'expense',
      movementSubtype: 'advance',
      amount: -300000,
    });
    expect(cuenta).toMatchObject({ accountId: 'cuenta-1', kind: 'income', movementSubtype: 'advance', amount: 300000 });
  });
});
