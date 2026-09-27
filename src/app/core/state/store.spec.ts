import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../api/api-client';
import type { ApiMovement, CreateMovementBody } from '../api/ledger.api';
import { I18nService, preloadCatalog } from '../i18n';
import en from '../i18n/en';
import es from '../i18n/es';
import { todayIso } from '../utils/dates';
import { BASE_CURRENCY, baseCurrency, currencyCatalog, LOCAL_CURRENCIES } from '../utils/money';
import { AppStore } from './store';

describe('AppStore', () => {
  let store: AppStore;

  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    store = TestBed.inject(AppStore);
  });

  it('filters the ledger without mutating the fixture', () => {
    const total = store.data().movements.length;
    store.query.set('nómina');
    expect(store.movements().length).toBeGreaterThan(0);
    expect(store.movements().every((movement) => movement.description.toLowerCase().includes('nómina'))).toBe(true);
    expect(store.data().movements).toHaveLength(total);
  });

  it('creates both balanced legs for a transfer', () => {
    const before = store.data().movements.length;
    store.save({
      kind: 'transfer',
      date: '2026-08-31',
      description: 'Transferencia de prueba',
      accountId: 'savings-main',
      targetId: 'savings-goals',
      amount: 250000,
      category: 'Transferencias',
    });
    const created = store.data().movements.filter((movement) => movement.description === 'Transferencia de prueba');
    expect(store.data().movements).toHaveLength(before + 2);
    expect(created.map((movement) => movement.amount).sort((a, b) => a - b)).toEqual([-250000, 250000]);
  });

  it('tags a transfer as expense/income, not its own kind, so KPIs can exclude it', () => {
    store.save({
      kind: 'transfer',
      date: '2026-08-31',
      description: 'Transferencia etiquetada',
      accountId: 'savings-main',
      targetId: 'savings-goals',
      amount: 300000,
      category: 'Transferencias',
    });
    const [saliente, entrante] = store
      .data()
      .movements.filter((movement) => movement.description === 'Transferencia etiquetada')
      .sort((a, b) => a.amount - b.amount);
    expect(saliente).toMatchObject({ kind: 'expense', movementSubtype: 'transfer', amount: -300000 });
    expect(entrante).toMatchObject({ kind: 'income', movementSubtype: 'transfer', amount: 300000 });
  });

  it('excludes a transfer from income and expense totals: money only moved accounts', () => {
    const antes = { income: store.income(), expense: store.expense() };
    store.save({
      kind: 'transfer',
      date: '2026-08-31',
      description: 'Transferencia neutra',
      accountId: 'savings-main',
      targetId: 'savings-goals',
      amount: 300000,
      category: 'Transferencias',
    });
    expect(store.income()).toBe(antes.income);
    expect(store.expense()).toBe(antes.expense);
  });

  it('creates a cash advance from a credit card into a cash account, tagged apart from a real expense', () => {
    store.save({
      kind: 'advance',
      date: '2026-08-31',
      description: 'Avance de prueba',
      accountId: 'credit-emerald',
      targetId: 'cash',
      amount: 200000,
      category: 'Transferencias',
    });
    const [saliente, entrante] = store
      .data()
      .movements.filter((movement) => movement.description === 'Avance de prueba')
      .sort((a, b) => a.amount - b.amount);
    expect(saliente).toMatchObject({
      accountId: 'credit-emerald',
      kind: 'expense',
      movementSubtype: 'advance',
      amount: -200000,
    });
    expect(entrante).toMatchObject({ accountId: 'cash', kind: 'income', movementSubtype: 'advance', amount: 200000 });
  });

  it('keeps the chosen loan product on the saved movement', () => {
    store.save({
      kind: 'expense',
      date: '2026-08-31',
      description: 'Cuota crédito hipotecario',
      accountId: 'savings-main',
      amount: 850000,
      category: 'Préstamos',
      loanProduct: 'mortgage',
    });
    const movimiento = store.data().movements.find((movement) => movement.description === 'Cuota crédito hipotecario');
    expect(movimiento?.loanProduct).toBe('mortgage');
  });

  it('registers a bank credit as incoming debt with monthly rate and term', async () => {
    const banco = await store.createCounterparty('Banco Andino', 'institution');
    await store.save({
      kind: 'income',
      operationType: 'credit',
      date: '2026-08-31',
      description: 'Crédito vehículo',
      accountId: 'savings-main',
      amount: 12_000_000,
      category: '',
      counterpartyId: banco.id,
      loanProduct: 'vehicle',
      monthlyRate: 1.5,
      termMonths: 36,
    });
    const movimiento = store.data().movements.find((movement) => movement.description === 'Crédito vehículo');
    expect(movimiento).toMatchObject({
      kind: 'income',
      amount: 12_000_000,
      loanRole: 'borrowed',
      loanProduct: 'vehicle',
      person: 'Banco Andino',
      installmentTotal: 36,
    });
    expect(store.data().people.find((persona) => persona.id === banco.id)?.kind).toBe('institution');
  });

  it('rejects a loan without a counterparty', async () => {
    await expect(
      store.save({
        kind: 'expense',
        operationType: 'loan',
        date: '2026-08-31',
        description: 'Préstamo sin persona',
        accountId: 'savings-main',
        amount: 100_000,
        category: '',
      }),
    ).rejects.toThrow();
  });

  it('preserves credit card terms entered in the shared account form', () => {
    store.createAccount('Tarjeta viajera', 'credit', 0, 'USD', 4200, { limit: 9000, cutDay: 12, dueDay: 27 });
    const account = store.data().accounts.find((item) => item.name === 'Tarjeta viajera');
    expect(account).toMatchObject({
      type: 'credit',
      currency: 'USD',
      exchangeRate: 4200,
      limit: 9000,
      cutDay: 12,
      dueDay: 27,
    });
  });

  it('rejects a transfer to the source account', async () => {
    await expect(
      store.save({
        kind: 'transfer',
        date: '2026-08-31',
        description: 'Inválida',
        accountId: 'savings-main',
        targetId: 'savings-main',
        amount: 1,
        category: 'Transferencias',
      }),
    ).rejects.toThrow('Selecciona una cuenta destino diferente.');
  });

  it('keeps management forms useful in explicit demo mode', async () => {
    await store.createPerson('Persona nueva', 'persona@example.test');
    await store.createInvestment('CDT nuevo', 'CDT', 'COP');
    await store.createCategory('Mascotas', '#087f68', '●');
    expect(store.data().people.some((person) => person.name === 'Persona nueva')).toBe(true);
    expect(store.data().investments.some((investment) => investment.name === 'CDT nuevo')).toBe(true);
    expect(store.history().some((event) => event.action.includes('Categoría Mascotas'))).toBe(true);
  });

  it('does not materialize a recurrence into the ledger while it is only a projection', async () => {
    const before = store.data().movements.length;
    await store.createRecurrence('Arriendo futuro', 1800000, 'savings-main', 3, '2026-10-01');
    expect(store.data().movements).toHaveLength(before);
    expect(store.history()[0].action).toContain('Recurrencia Arriendo futuro');
  });
});

describe('sesión demo persistida', () => {
  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('no inicia sesión cuando no hay perfil guardado', () => {
    const store = TestBed.inject(AppStore);
    store.restoreDemoSession();
    // Number(null) es 0 y 0 es un índice válido: sin la guarda explícita, no
    // haber iniciado sesión entraba como el primer perfil.
    expect(store.user()).toBeNull();
  });

  it('recupera el perfil elegido tras recargar', () => {
    const store = TestBed.inject(AppStore);
    store.rememberDemoSession(1);
    store.restoreDemoSession();
    expect(store.user()).toBe(store.users[1]);
  });

  it('ignora un índice guardado fuera de rango', () => {
    const store = TestBed.inject(AppStore);
    sessionStorage.setItem('finanzas.demo.perfil', '99');
    store.restoreDemoSession();
    expect(store.user()).toBeNull();
  });

  it('olvida el perfil al cerrar sesión', () => {
    const store = TestBed.inject(AppStore);
    store.rememberDemoSession(0);
    store.forgetDemoSession();
    store.restoreDemoSession();
    expect(store.user()).toBeNull();
  });
});

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
    window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: 'https://api.example.test' };
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
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
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

  it('resuelve el día numérico del calendario contra el mes en curso', async () => {
    const dia = `${todayIso().slice(0, 7)}-05`;
    await store.save({
      kind: 'expense',
      date: dia,
      description: 'Gasto del día 5',
      accountId: 'savings-main',
      amount: 1000,
      category: 'Comida',
    });

    expect(store.dayMoves(5).map((movement) => movement.description)).toContain('Gasto del día 5');
  });

  it('crea una cuenta corriente y una billetera como lo que son, no como ahorro', async () => {
    await store.createAccount('Cuenta corriente', 'checking', 0, 'COP');
    await store.createAccount('Billetera', 'wallet', 0, 'COP');

    const tipos = store
      .data()
      .accounts.filter((account) => account.name === 'Cuenta corriente' || account.name === 'Billetera')
      .map((account) => account.type);
    expect(tipos).toEqual(['checking', 'wallet']);
  });

  it('dice los errores de validación en el idioma cargado, no siempre en español', async () => {
    preloadCatalog('en', en);
    await TestBed.inject(I18nService).load('en');

    await expect(
      store.save({
        kind: 'transfer',
        date: '2026-08-31',
        description: 'Inválida',
        accountId: 'savings-main',
        targetId: 'savings-main',
        amount: 1,
        category: 'Transferencias',
      }),
    ).rejects.toThrow(en['form.movement.error.targetDifferent']);
  });
});
