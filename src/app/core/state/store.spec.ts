import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import type { ApiMovement, CreateMovementBody } from '@core/api';
import { preloadCatalog } from '@core/i18n';
import es from '@core/i18n/es';
import { todayIso, BASE_CURRENCY, baseCurrency, currencyCatalog, LOCAL_CURRENCIES } from '@core/utils';
import { AppStore } from './store';


describe('AppStore en modo API', () => {
  // Respuesta simulada del servidor. Lo que manda al reconstruir la copia
  // optimista es esto —y no el formulario—, porque es lo que sobrevive a la recarga.
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
      // El catálogo local puede estar desfasado; el nombre del servidor es el que
      // se verá al recargar, así que la copia optimista no debe repetir el local.
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

  /** Monta la tienda en modo API con un cliente simulado y un catálogo conocido. */
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

    await store.save({
      kind: 'expense',
      date: '2026-09-25',
      description: 'Mercado del sábado',
      accountId: 'cuenta-1',
      amount: 45900,
      category: 'Mercado',
      person: 'Camilo',
    });

    // El cuerpo del POST lleva los enlaces por id: sin ellos, el movimiento
    // reaparecía «Sin categoría» y sin persona al recargar.
    expect(payloads).toHaveLength(1);
    expect(payloads[0].links).toEqual({
      account: 'cuenta-1',
      category: 'categoria-1',
      counterparty: 'persona-1',
    });
    // Y la copia optimista refleja lo que devolvió el servidor, no el formulario.
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

    await store.save({
      kind: 'expense',
      date: '2026-09-25',
      description: 'Gasto sin clasificar',
      accountId: 'cuenta-1',
      amount: 1000,
      category: 'Categoría inexistente',
      person: 'Persona inexistente',
    });

    expect(payloads[0].links).toEqual({ account: 'cuenta-1' });
    // Sin contraparte guardada, el movimiento no es un préstamo.
    expect(store.data().movements[0]).toMatchObject({ ownership: 'own', amount: -1000 });
  });

  it('escribe el kind que distingue el backend en vez de adivinar ahorro o efectivo', async () => {
    const payloads: { name: string; kind: number }[] = [];
    const store = montar({
      createAccount: vi.fn((body: { name: string; kind: number }) => {
        payloads.push(body);
        return of({ id: `cuenta-${payloads.length}`, name: body.name, currency: 'COP', lastFour: '0000' });
      }),
    });

    await store.createAccount('Corriente', 'checking', 0, 'COP');
    await store.createAccount('Billetera', 'wallet', 0, 'COP');
    await store.createAccount('Otra', 'other', 0, 'COP');

    // AccountKindDto: Checking=2, Wallet=4, Other=99. Antes eran dos números escritos
    // a mano (`cash ? 1 : 3`), de modo que estas cuentas volvían como ahorro.
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

  // La moneda base y el catálogo son estado del módulo, compartido por todo el proceso
  // de pruebas, y el idioma pre-cargado vive fuera de TestBed: sin devolverlos, una
  // prueba en USD o en inglés dejaría las siguientes en USD o en inglés.
  afterEach(() => {
    baseCurrency.set(BASE_CURRENCY);
    currencyCatalog.set(LOCAL_CURRENCIES);
    preloadCatalog('es', es);
  });

  it('el canal de avisos publica cada aviso aunque el texto se repita', () => {
    store.toast.set('Aviso guardado');
    expect(store.toast.texto()).toBe('Aviso guardado');

    // Dos avisos idénticos seguidos son dos avisos: quien reaccione por separado no
    // debe creer que la segunda escritura no ocurrió.
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
    // COP publica cero decimales: los centavos de una organización en USD no deben
    // seguir apareciendo cuando la organización no es la misma.
    expect(store.money(1234)).toContain('1.234');
    expect(store.money(1234)).not.toContain(',');
  });

  it('el calendario y el historial arrancan en hoy, no en una fecha escrita en el código', () => {
    expect(store.selectedCalendarDate()).toBe(todayIso());
    expect(store.history()[0].date).toBe(todayIso());
  });



});
