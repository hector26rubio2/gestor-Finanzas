import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiMovement } from '@core/api/ledger.api';
import {
  AccountsCommands,
  CatalogCommands,
  CategoriesCommands,
  InvestmentsCommands,
  PeopleCommands,
  RecurrenceCommands,
} from '@core/state';
import { Movement, Person } from '@core/state/view-model';
import { PRIORIDAD_EN_PESOS } from '@core/api/card-buckets';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';
import { describe, expect, it, vi } from 'vitest';

@Component({ selector: 'prueba-comandos-catalogo', template: '' })
class ComponenteVacio {
  readonly comandos = inject(CatalogCommands);
}

/** ApiMovement crudo mínimo para la pata de apertura del transport falso. */
function apiMovement(opts: { id: string } & Partial<ApiMovement>): ApiMovement {
  return {
    date: '2026-10-22',
    kind: 1,
    effect: 1,
    flow: 1,
    amount: {
      original: { amount: '300000', currency: 'COP' },
      base: { amount: '300000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-10-22',
    },
    links: {},
    linkNames: {},
    origin: 0,
    description: 'Saldo de apertura',
    createdAt: '2026-10-22T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...opts,
  } as ApiMovement;
}

/** ApiAccount crudo tal como lo devuelve el backend. */
function apiCuenta(opts: { id: string; name: string; kind: number } & Record<string, unknown>): unknown {
  return {
    currency: 'COP',
    institution: null,
    lastFour: null,
    isDefault: false,
    isActive: true,
    createdAt: '2026-10-22T12:00:00Z',
    issuerEntity: null,
    ...opts,
  };
}

describe('CatalogCommands — contrapartes y personas', () => {
  it('createCounterparty: POST /people con kind persona, añade persona con deudas en cero y cierra el form', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', {
      body: { id: 'persona-nueva', displayName: 'Laura Gil', email: null },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({ people: [] }),
      transport,
    });
    cambios();

    const creada = await component.comandos.createCounterparty('Lau Gil', 'person', 'lau@test.dev');

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/people' });
    expect(peticion.body).toEqual({ displayName: 'Lau Gil', email: 'lau@test.dev', kind: 1 });

    expect(creada).toEqual({
      id: 'persona-nueva',
      name: 'Laura Gil',
      owed: 0,
      owing: 0,
      kind: 'person',
      email: 'lau@test.dev',
    });
    expect(store.data().people.map((p: Person) => p.id)).toContain('persona-nueva');
    expect(store.form()).toBeNull();
    expect(store.toast.texto).toBeDefined();
  });

  it('createCounterparty sin nombre se rechaza sin pedir nada a la API', async () => {
    const transport = new TransportFalso();
    const { component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe({ people: [] }), transport });
    cambios();
    await expect(component.comandos.createCounterparty('   ')).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });

  it('createCounterparty institución: kind 2', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', {
      body: { id: 'entidad-1', displayName: 'Banquito', email: null },
    });
    const { component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe({ people: [] }), transport });
    cambios();

    await component.comandos.createCounterparty('Banquito', 'institution');

    expect(transport.peticiones[0].body).toMatchObject({ kind: 2 });
  });

  it('createPerson con relación: crea contraparte y mapea la relación sobre la persona nueva', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', {
      body: { id: 'persona-nueva', displayName: 'Laura Gil', email: null },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe({ people: [] }), transport });
    cambios();

    await component.comandos.createPerson('Laura Gil', 'lau@test.dev', 'Familia');

    const creada = store.data().people.find((p: Person) => p.id === 'persona-nueva');
    expect(creada).toMatchObject({ name: 'Laura Gil', relationship: 'Familia' });
    expect(transport.peticiones[0].body).toMatchObject({ displayName: 'Laura Gil', relationship: 'Familia' });
    expect(store.toast.revision()).toBeGreaterThan(0);
    expect(store.form()).toBeNull();
  });
});

describe('CatalogCommands — cuentas y tarjetas', () => {
  it('createAccount sin apertura: POST /accounts y añade la cuenta al store', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/accounts', {
      body: apiCuenta({ id: 'cuenta-nueva', name: 'Corriente', kind: 2 }),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({ accounts: [], movements: [] }),
      transport,
    });
    cambios();

    await component.comandos.createAccount('Corriente', 'checking', 0, 'COP');

    const [peticion] = transport.peticiones;
    expect(peticion.body).toEqual({ name: 'Corriente', kind: 2, currency: 'COP', lastFour: null, issuerEntity: null });
    expect(store.data().accounts).toMatchObject([
      { id: 'cuenta-nueva', name: 'Corriente', type: 'checking', openingBalance: 0 },
    ]);
    expect(store.form()).toBeNull();
  });

  it('createAccount con apertura: usa /accounts/with-opening, crea la cuenta y la pata de ingreso', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/accounts/with-opening', {
      body: {
        account: apiCuenta({ id: 'cuenta-nueva', name: 'Ahorro nuevo', kind: 3 }),
        openingMovement: apiMovement({ id: 'mov-apertura', description: 'Saldo de apertura' }),
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({ accounts: [], movements: [] }),
      transport,
    });
    cambios();

    await component.comandos.createAccount('Ahorro nuevo', 'savings', 300000, 'COP');

    expect(transport.peticiones).toHaveLength(1);
    expect(transport.peticiones[0].path).toBe('/api/v1/accounts/with-opening');
    expect(transport.peticiones[0].body).toMatchObject({
      openingBalance: { amount: '300000', currency: 'COP' },
    });
    expect(store.data().accounts).toHaveLength(1);
    const apertura = store.data().movements[0];
    expect(apertura).toMatchObject({
      id: 'mov-apertura',
      accountId: 'cuenta-nueva',
      category: 'Apertura',
      kind: 'income',
      amount: 300000,
      status: 'confirmed',
    });
  });

  it('createAccount de noche: la apertura lleva la fecha local y no la del día siguiente en UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 23, 30));
    try {
      const transport = new TransportFalso().responder('POST /api/v1/accounts/with-opening', {
        body: {
          account: apiCuenta({ id: 'cuenta-nueva', name: 'Ahorro nuevo', kind: 3 }),
          openingMovement: apiMovement({ id: 'mov-apertura', description: 'Saldo de apertura' }),
        },
      });
      const { component, cambios } = pruebaRender(ComponenteVacio, {
        data: datosDe({ accounts: [], movements: [] }),
        transport,
      });
      cambios();

      await component.comandos.createAccount('Ahorro nuevo', 'savings', 300000, 'COP');

      expect(transport.peticiones[0].body).toMatchObject({ date: '2026-10-28' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('createAccount tarjeta: construye terms completos, mapea la tarjeta a Account de crédito', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/cards', {
      body: {
        id: 'tarjeta-nueva',
        name: 'Visa',
        currency: 'COP',
        creditLimit: { amount: '5000000', currency: 'COP' },
        cycle: { statementDay: 5, paymentDueDay: 20 },
        terms: { purchaseApr: { rate: '0.23' }, cashAdvanceApr: { rate: '0.23' }, dualCurrency: true },
        issuer: null,
        lastFour: '4321',
        isActive: true,
        createdAt: '2026-10-22T12:00:00Z',
        issuerEntity: { id: 'emisor-1', name: 'Banco Uno' },
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({ accounts: [], movements: [] }),
      transport,
    });
    cambios();

    await component.comandos.createAccount(
      'Visa',
      'credit',
      0,
      'COP',
      undefined,
      {
        limit: 5000000,
        cutDay: 5,
        dueDay: 20,
        monthlyRate: 2,
        paymentPriority: [1, 5],
        monthlyFee: 50000,
        dualCurrency: true,
        issuerId: 'emisor-1',
      },
      '4321',
      'emisor-1',
    );

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/cards' });
    expect(peticion.body).toMatchObject({
      creditLimit: { amount: '5000000', currency: 'COP' },
      cycle: { statementDay: 5, paymentDueDay: 20 },
      // 2 % mensual anualizado (redondeado por anualDesdeMensual), enviado como fracción
      terms: { purchaseApr: { rate: '0.26824000000000003' } },
      lastFour: '4321',
      issuerEntity: 'emisor-1',
    });
    const tarjeta = store.data().accounts[0];
    expect(tarjeta).toMatchObject({
      id: 'tarjeta-nueva',
      type: 'credit',
      limit: 5000000,
      annualRate: 26.824,
      cutDay: 5,
      dueDay: 20,
      lastFour: '4321',
      monthlyFee: 50000,
      dualCurrency: true,
    });
    // la tarjeta remota no manda prioridad: se completa con la de pesos
    expect(tarjeta.paymentPriority).toEqual(PRIORIDAD_EN_PESOS);
    expect(store.form()).toBeNull();
  });

  it('createAccount valida: apertura negativa, lastFour mal formato y tarjeta sin límite se rechazan sin pedir nada', async () => {
    const transport = new TransportFalso();
    const { component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe({ accounts: [] }), transport });
    cambios();

    await expect(component.comandos.createAccount('X', 'savings', -1)).rejects.toThrow();
    await expect(
      component.comandos.createAccount('X', 'savings', 0, 'COP', undefined, undefined, '12a'),
    ).rejects.toThrow();
    await expect(
      component.comandos.createAccount('X', 'credit', 0, 'COP', undefined, { limit: 0, cutDay: 1, dueDay: 2 }),
    ).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });

  it('updateAccount (cuenta simple): GET /accounts para los datos remotos y PUT con lastFour/issuerEntity', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/accounts', {
        body: [
          apiCuenta({
            id: 'cuenta-1',
            name: 'Ahorros',
            kind: 3,
            isDefault: true,
            issuerEntity: { id: 'emisor-1', name: 'Banco' },
          }),
        ],
      })
      .responder('PUT /api/v1/accounts/cuenta-1', {
        body: apiCuenta({ id: 'cuenta-1', name: 'Ahorros del agro', kind: 3 }),
      });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        accounts: [{ id: 'cuenta-1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 }],
      }),
      transport,
    });
    cambios();

    await component.comandos.updateAccount(store.data().accounts[0], { name: 'Ahorros del agro' });

    expect(transport.peticiones[0]).toMatchObject({ method: 'GET', path: '/api/v1/accounts' });
    expect(transport.peticiones[1].body).toMatchObject({
      name: 'Ahorros del agro',
      lastFour: null,
      isDefault: true,
      issuerEntity: 'emisor-1',
    });
    expect(store.data().accounts[0]).toMatchObject({ name: 'Ahorros del agro', type: 'savings' });
    expect(store.form()).toBeNull();
  });

  it('updateAccount (tarjeta): GET /cards, PUT /cards/:id con conTasa/conPrioridad y copia local de crédito', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/cards', {
        body: [
          {
            id: 'tarjeta-1',
            name: 'Visa',
            currency: 'COP',
            creditLimit: { amount: '5000000', currency: 'COP' },
            cycle: { statementDay: 5, paymentDueDay: 20 },
            terms: {
              purchaseApr: { rate: '0.23' },
              paymentPriority: [1, 5],
              monthlyFee: { amount: '50000', currency: 'COP' },
            },
            issuer: null,
            lastFour: '4321',
            isActive: true,
            createdAt: '2026-10-22T12:00:00Z',
            issuerEntity: null,
          },
        ],
      })
      .responder('PUT /api/v1/cards/tarjeta-1', {
        body: {
          id: 'tarjeta-1',
          name: 'Visa actualizada',
          currency: 'COP',
          creditLimit: { amount: '6000000', currency: 'COP' },
          cycle: { statementDay: 7, paymentDueDay: 22 },
          terms: { purchaseApr: { rate: '0.32' } },
          issuer: null,
          lastFour: '9999',
          isActive: true,
          createdAt: '2026-10-22T12:00:00Z',
          issuerEntity: null,
        },
      });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        accounts: [
          {
            id: 'tarjeta-1',
            name: 'Visa',
            type: 'credit',
            currency: 'COP',
            openingBalance: 0,
            limit: 5000000,
            cutDay: 5,
            dueDay: 20,
          },
        ],
        movements: [],
      }),
      transport,
    });
    cambios();

    await component.comandos.updateAccount(store.data().accounts[0], {
      name: 'Visa actualizada',
      lastFour: '9999',
      credit: { limit: 6000000, cutDay: 7, dueDay: 22, monthlyRate: 2.4, monthlyFee: 60000, dualCurrency: false },
    });

    const peticionPut = transport.peticiones[1];
    expect(peticionPut).toMatchObject({ method: 'PUT', path: '/api/v1/cards/tarjeta-1' });
    expect(peticionPut.body).toMatchObject({
      name: 'Visa actualizada',
      creditLimit: { amount: '6000000', currency: 'COP' },
      lastFour: '9999',
      isActive: true,
    });
    // conTasa: la tasa mensual nueva anualiza/aplasta la purchaseApr de la remota
    const terms = (peticionPut.body as { terms: { purchaseApr: { rate: string } } }).terms;
    expect(terms.purchaseApr.rate).toBe('0.32923'); // 2.4 % mensual anualizado
    const actualizada = store.data().accounts[0];
    expect(actualizada).toMatchObject({
      name: 'Visa actualizada',
      limit: 6000000,
      cutDay: 7,
      dueDay: 22,
      annualRate: 32.923,
      monthlyFee: 60000,
      dualCurrency: false,
    });
  });
});

describe('CatalogCommands — categorías', () => {
  it('createCategory: POST /categories con tipo según kind, agrega al catálogo y avisa', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/categories', {
      body: {
        id: 'categoria-nueva',
        name: 'Salud',
        type: 2,
        color: '#e11d48',
        icon: '✚',
        parent: null,
        isActive: true,
        createdAt: '2026-10-22',
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
    cambios();

    await component.comandos.createCategory('Salud', '#e11d48', '✚');

    expect(transport.peticiones[0].body).toEqual({ name: 'Salud', type: 2, color: '#e11d48', icon: '✚' });
    expect(store.categories().map((c) => c.id)).toContain('categoria-nueva');
    expect(store.form()).toBeNull();
    expect(store.toast.revision()).toBeGreaterThan(0);
  });

  it('createCategoryInline crea la categoría sin cerrar el formulario abierto y la devuelve', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/categories', {
      body: {
        id: 'cat-x',
        name: 'Mascotas',
        type: 2,
        color: '#64748b',
        icon: 'tag',
        parent: null,
        isActive: true,
        createdAt: '',
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
    cambios();
    store.form.set({ kind: 'expense' });

    const creada = await component.comandos.createCategoryInline('  Mascotas ', 'expense');

    expect(transport.peticiones[0].body).toMatchObject({ name: 'Mascotas', type: 2 });
    expect(creada.name).toBe('Mascotas');
    expect(store.categories().map((c) => c.id)).toContain('cat-x');
    expect(store.form()).not.toBeNull();
  });

  it('updateCategory con renombrado: PUT y re-mapa category en TODOS los movimientos', async () => {
    const transport = new TransportFalso().responder('PUT /api/v1/categories/categoria-1', {
      body: {
        id: 'categoria-1',
        name: 'Mercado mayor',
        type: 2,
        color: '#0f766e',
        icon: '●',
        parent: null,
        isActive: true,
        createdAt: '2026-09-01',
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        movements: [
          {
            id: 'mov-1',
            date: '2026-09-25',
            description: 'Compras',
            accountId: 'cuenta-1',
            category: 'Mercado',
            kind: 'expense',
            amount: -45900,
            status: 'confirmed',
          },
          {
            id: 'mov-2',
            date: '2026-09-26',
            description: 'Otros',
            accountId: 'cuenta-1',
            category: 'Otros',
            kind: 'expense',
            amount: -100,
            status: 'confirmed',
          },
        ],
      }),
      transport,
    });
    cambios();

    await component.comandos.updateCategory('categoria-1', { name: 'Mercado mayor', color: '#0f766e', icon: '●' });

    expect(transport.peticiones[0].body).toMatchObject({
      name: 'Mercado mayor',
      color: '#0f766e',
      icon: '●',
      parent: null,
      isActive: true,
    });
    expect(store.data().movements.map((m: Movement) => m.category)).toEqual(['Mercado mayor', 'Otros']);
    expect(store.categories()[0].name).toBe('Mercado mayor');
  });
});

describe('CatalogCommands — personas', () => {
  it('updatePerson con renombrado: PUT /people/:id y re-mapa person en los movimientos', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/people', {
        body: [
          {
            id: 'persona-1',
            displayName: 'Camilo',
            alias: null,
            email: null,
            phone: '123',
            notes: null,
            isActive: true,
            createdAt: '2026-09-01',
            kind: 1,
          },
        ],
      })
      .responder('PUT /api/v1/people/persona-1', {
        body: {
          id: 'persona-1',
          displayName: 'Camilo Rojas',
          alias: null,
          email: null,
          phone: '123',
          notes: null,
          isActive: true,
          createdAt: '2026-09-01',
        },
      });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0, relationship: 'Amistad' }],
        movements: [
          {
            id: 'mov-1',
            date: '2026-09-25',
            description: 'Prestado',
            accountId: 'cuenta-1',
            category: 'Otros',
            kind: 'expense',
            amount: -100,
            status: 'confirmed',
            person: 'Camilo',
          },
        ],
      }),
      transport,
    });
    cambios();

    await component.comandos.updatePerson('persona-1', { name: 'Camilo Rojas', email: 'c@t.dev' });

    expect(transport.peticiones[1].body).toMatchObject({
      displayName: 'Camilo Rojas',
      email: 'c@t.dev',
      phone: '123',
      isActive: true,
    });
    const persona = store.data().people[0];
    expect(persona).toMatchObject({ name: 'Camilo Rojas', email: 'c@t.dev', relationship: 'Amistad' });
    expect(store.data().movements[0].person).toBe('Camilo Rojas');
    expect(store.toast.revision()).toBeGreaterThan(0);
  });

  it('updatePerson cambia de kind: envía kind de ente y actualiza la persona', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/people', {
        body: [
          {
            id: 'persona-1',
            displayName: 'Camilo',
            alias: null,
            email: null,
            phone: null,
            notes: null,
            isActive: true,
            createdAt: '2026-09-01',
            kind: 1,
          },
        ],
      })
      .responder('PUT /api/v1/people/persona-1', {
        body: {
          id: 'persona-1',
          displayName: 'Camilo SA',
          alias: null,
          email: null,
          phone: null,
          notes: null,
          isActive: true,
          createdAt: '2026-09-01',
        },
      });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
    cambios();

    await component.comandos.updatePerson('persona-1', { name: 'Camilo SA', kind: 'institution' });

    expect(transport.peticiones[1].body).toMatchObject({ kind: 2 });
    expect(store.data().people[0]).toMatchObject({ name: 'Camilo SA', kind: 'institution' });
  });
});

describe('CatalogCommands — inversiones', () => {
  it('createInvestment: POST /investments y añade el viewmodel con cost/value parseados', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/investments', {
      body: {
        id: 'inversion-nueva',
        name: 'CEFAS',
        instrumentType: 'savings',
        currency: 'COP',
        costBasis: { amount: '1000000', currency: 'COP' },
        marketValue: { amount: '1200000', currency: 'COP' },
        isActive: true,
        risk: 2,
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({ movements: [] }),
      transport,
    });
    cambios();

    await component.comandos.createInvestment('CEFAS', 'savings', 'COP');

    expect(transport.peticiones[0].body).toEqual({
      name: 'CEFAS',
      instrumentType: 'savings',
      currency: 'COP',
      risk: 2,
    });
    const inversion = store.data().investments[0];
    expect(inversion).toMatchObject({
      id: 'inversion-nueva',
      name: 'CEFAS',
      cost: 1000000,
      value: 1200000,
      currency: 'COP',
      units: 0,
      risk: 'Medio',
      liquidity: 'Programada',
    });
    expect(store.toast.revision()).toBeGreaterThan(0);
  });

  it('updateInvestment: GET /investments, PUT con risk/symbol remotos y copia local', async () => {
    const transport = new TransportFalso()
      .responder('GET /api/v1/investments', {
        body: [
          {
            id: 'inversion-1',
            name: 'CEFAS',
            instrumentType: 'cdt',
            currency: 'COP',
            costBasis: { amount: '1', currency: 'COP' },
            marketValue: null,
            isActive: true,
            risk: 3,
            symbol: 'CEFA-X',
          },
        ],
      })
      .responder('PUT /api/v1/investments/inversion-1', {
        body: {
          id: 'inversion-1',
          name: 'Bonos',
          instrumentType: 'cdt',
          currency: 'COP',
          costBasis: { amount: '1', currency: 'COP' },
          marketValue: null,
          isActive: true,
          risk: 3,
        },
      });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        movements: [],
        investments: [
          {
            id: 'inversion-1',
            name: 'CEFAS',
            type: 'cdt',
            cost: 1,
            value: 1,
            institution: '',
            currency: 'COP',
            units: 0,
            risk: 'Alto',
            liquidity: 'Programada',
          },
        ],
      }),
      transport,
    });
    cambios();

    await component.comandos.updateInvestment('inversion-1', { name: 'Bonos', instrumentType: 'cdt' });

    expect(transport.peticiones[1].body).toMatchObject({
      name: 'Bonos',
      instrumentType: 'cdt',
      risk: 3,
      symbol: 'CEFA-X',
    });
    expect(store.data().investments[0]).toMatchObject({ name: 'Bonos', type: 'cdt' });
    expect(store.form()).toBeNull();
  });
});

describe('CatalogCommands — recurrencias', () => {
  it('createRecurrence en cuenta simple: plantilla 2, target account', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/recurrences', { body: { id: 'rec-1' } });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
    cambios();

    await component.comandos.createRecurrence('Arriendo', 800000, 'cuenta-1', 3, '2026-11-01');

    expect(transport.peticiones[0].body).toMatchObject({
      name: 'Arriendo',
      movementTemplate: 2,
      amount: { amount: '800000', currency: 'COP' },
      target: { account: 'cuenta-1' },
      schedule: { frequency: 3, interval: 1, start: '2026-11-01', dayOfMonth: 1, dayOfWeek: null },
    });
    expect(store.form()).toBeNull();
  });

  it('createRecurrence en tarjeta: plantilla 20 y target card', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/recurrences', { body: { id: 'rec-1' } });
    const { component, cambios } = pruebaRender(ComponenteVacio, {
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5000000 },
        ],
        movements: [],
      }),
      transport,
    });
    cambios();

    await component.comandos.createRecurrence('Suscripción', 30000, 'tarjeta-1', 2, '2026-11-05');

    expect(transport.peticiones[0].body).toMatchObject({ movementTemplate: 20, target: { card: 'tarjeta-1' } });
  });

  it('createRecurrence con cuenta inexistente se rechaza sin pedir nada a la API', async () => {
    const transport = new TransportFalso();
    const { component, cambios } = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
    cambios();
    await expect(
      component.comandos.createRecurrence('Rara', 100, 'cuenta-fantasma', 3, '2026-11-01'),
    ).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });
});

describe('CatalogCommands — fachadas por entidad (cableado DI)', () => {
  it('cada grupo de comandos es un inyectable raíz y la fachada delega en ellos', () => {
    const { cambios } = pruebaRender(ComponenteVacio, { data: datosDe() });
    const cuenta = TestBed.inject(AccountsCommands);
    const categoria = TestBed.inject(CategoriesCommands);
    const persona = TestBed.inject(PeopleCommands);
    const inversion = TestBed.inject(InvestmentsCommands);
    const recurrencia = TestBed.inject(RecurrenceCommands);
    expect(cuenta).toBeDefined();
    expect(categoria).toBeDefined();
    expect(persona).toBeDefined();
    expect(inversion).toBeDefined();
    expect(recurrencia).toBeDefined();
    // la fachada expone los mismos métodos que los grupos (delegación 1:1)
    expect(typeof cuenta.createAccount).toBe('function');
    expect(typeof cuenta.updateAccount).toBe('function');
    expect(typeof categoria.createCategory).toBe('function');
    expect(typeof categoria.updateCategory).toBe('function');
    expect(typeof persona.createCounterparty).toBe('function');
    expect(typeof persona.createPerson).toBe('function');
    expect(typeof persona.updatePerson).toBe('function');
    expect(typeof inversion.createInvestment).toBe('function');
    expect(typeof inversion.updateInvestment).toBe('function');
    expect(typeof recurrencia.createRecurrence).toBe('function');
    expect(cambios()).toBeDefined();
  });
});
