import { CatalogCommands, MovementCommands } from '@core/state';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api/api-client';
import type { ApiMovement, CreateMovementBody } from '@core/api/ledger.api';
import { preloadCatalog } from '@core/i18n';
import es from '@core/i18n/es';
import { todayIso } from '@core/utils/dates';
import { BASE_CURRENCY, baseCurrency, currencyCatalog, LOCAL_CURRENCIES } from '@core/utils/money';
import { AppStore } from './store';

describe('AppStore en modo API', () => {
  const respuesta: ApiMovement = {
    id: 'mov-remoto-1',
    date: '2026-09-25',
    kind: 2,
    effect: 2,
    flow: 2,
    amount: {
      original: { amount: '45900', currency: 'COP' },
      base: { amount: '45900', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    links: { account: 'cuenta-1', category: 'categoria-1', counterparty: 'persona-1' },
    linkNames: {
      category: { id: 'categoria-1', name: 'Supermercado' },
      counterparty: { id: 'persona-1', name: 'Camilo' },
    },
    origin: 0,
    description: 'Mercado del sábado',
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
  };

  const montar = (api: unknown) => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: FinanceApiClient, useValue: api }] });
    const store = TestBed.inject(AppStore);
    store.data.update((data) => ({
      ...data,
      accounts: [{ id: 'cuenta-1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 500000 }],
      people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 }],
    }));
    store.categories.set([
      {
        id: 'categoria-1',
        name: 'Mercado',
        type: 1,
        color: '#0f766e',
        icon: '●',
        parent: null,
        isActive: true,
        createdAt: '2026-09-01',
      },
    ]);
    return store;
  };

  it('envía categoría y persona al crear un gasto y la copia optimista nace de la respuesta', async () => {
    const payloads: CreateMovementBody[] = [];
    const store = montar({
      createMovement: vi.fn((request: CreateMovementBody) => {
        payloads.push(request);
        return of(respuesta);
      }),
    });

    await TestBed.inject(MovementCommands).save({
      kind: 'expense',
      date: '2026-09-25',
      description: 'Mercado del sábado',
      accountId: 'cuenta-1',
      amount: 45900,
      category: 'Mercado',
      person: 'Camilo',
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].links).toEqual({
      account: 'cuenta-1',
      category: 'categoria-1',
      counterparty: 'persona-1',
    });
    expect(store.data().movements[0]).toMatchObject({
      id: 'mov-remoto-1',
      category: 'Supermercado',
      person: 'Camilo',
      ownership: 'loaned',
      kind: 'expense',
      amount: -45900,
    });
  });

  it('no envía enlaces inventados cuando la categoría o la persona no existen', async () => {
    const payloads: CreateMovementBody[] = [];
    const sinEnlaces: ApiMovement = {
      ...respuesta,
      amount: {
        original: { amount: '1000', currency: 'COP' },
        base: { amount: '1000', currency: 'COP' },
        rate: '1',
        rateAsOf: '2026-09-25',
      },
      links: { account: 'cuenta-1' },
      linkNames: {},
    };
    const store = montar({
      createMovement: vi.fn((request: CreateMovementBody) => {
        payloads.push(request);
        return of(sinEnlaces);
      }),
    });

    await TestBed.inject(MovementCommands).save({
      kind: 'expense',
      date: '2026-09-25',
      description: 'Gasto sin clasificar',
      accountId: 'cuenta-1',
      amount: 1000,
      category: 'Categoría inexistente',
      person: 'Persona inexistente',
    });

    expect(payloads[0].links).toEqual({ account: 'cuenta-1' });
    expect(store.data().movements[0]).toMatchObject({ ownership: 'own', amount: -1000 });
  });

  it('escribe el kind que distingue el backend en vez de adivinar ahorro o efectivo', async () => {
    const payloads: { name: string; kind: number }[] = [];
    montar({
      createAccount: vi.fn((body: { name: string; kind: number }) => {
        payloads.push(body);
        return of({ id: `cuenta-${payloads.length}`, name: body.name, currency: 'COP', lastFour: '0000' });
      }),
    });

    await TestBed.inject(CatalogCommands).createAccount('Corriente', 'checking', 0, 'COP');
    await TestBed.inject(CatalogCommands).createAccount('Billetera', 'wallet', 0, 'COP');
    await TestBed.inject(CatalogCommands).createAccount('Otra', 'other', 0, 'COP');

    expect(payloads.map((body) => body.kind)).toEqual([2, 4, 99]);
  });
});

describe('AppStore: avisos, moneda base y fechas de hoy', () => {
  let store: AppStore;

  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
    TestBed.resetTestingModule();
    store = TestBed.inject(AppStore);
  });

  afterEach(() => {
    baseCurrency.set(BASE_CURRENCY);
    currencyCatalog.set(LOCAL_CURRENCIES);
    preloadCatalog('es', es);
  });

  it('el canal de avisos publica cada aviso aunque el texto se repita', () => {
    store.toast.set('Aviso guardado');
    expect(store.toast.texto()).toBe('Aviso guardado');

    const revision = store.toast.revision();
    store.toast.set('Aviso guardado');
    expect(store.toast.revision()).toBe(revision + 1);

    store.toast.update((actual) => `${actual} · otra vez`);
    expect(store.toast.texto()).toBe('Aviso guardado · otra vez');
    expect(store.toast.revision()).toBe(revision + 2);
  });

  it('etiqueta y suma en la moneda base de la sesión, no en COP de compilación', () => {
    baseCurrency.set('USD');
    expect(store.money(1234)).toContain('1.234,00');

    baseCurrency.set('COP');
    expect(store.money(1234)).toContain('1.234');
    expect(store.money(1234)).not.toContain(',');
  });

  it('el calendario y el historial arrancan en hoy, no en una fecha escrita en el código', () => {
    expect(store.selectedCalendarDate()).toBe(todayIso());
    expect(store.history()[0].date).toBe(todayIso());
  });
});
