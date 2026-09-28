import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from '@core/api/api-client';
import { BASE_CURRENCY, baseCurrency, currencyCatalog, LOCAL_CURRENCIES } from '@core/utils/money';
import { P } from './permissions';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { AppStore } from '@core/state/store';

describe('RemoteBootstrap', () => {
  const emptyPage = { items: [], page: 1, size: 25, total: 0, totalPages: 0, hasNext: false };
  const session = {
    user: { id: 'u1', displayName: 'Lectora', email: 'lectora@example.test', isActive: true },
    organization: {
      id: 'o1',
      name: 'Personal',
      slug: 'personal',
      baseCurrency: 'COP',
      isActive: true,
      createdAt: '',
    },
    capabilities: [],
    organizations: [],
    expiresAt: '',
    permissions: [
      P.dashboard.ver,
      P.movimientos.ver,
      P.cuentas.ver,
      P.cuentas.tarjetas.listar,
      P.cuentas.categorias.listar,
      P.calendario.ver,
    ] as string[],
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('pide solo lo que cada permiso concedido autoriza', async () => {
    const api = {
      session: vi.fn(() => of(session)),
      accounts: vi.fn(() => of([])),
      cards: vi.fn(() => of([])),
      categories: vi.fn(() => of([])),
      people: vi.fn(() => of([])),
      debts: vi.fn(() => of([])),
      investments: vi.fn(() => of([])),
      movements: vi.fn(() => of(emptyPage)),
      preferences: vi.fn(() =>
        of({
          userId: 'u1',
          language: 'es-CO',
          theme: 'light',
          font: 'Inter, system-ui, sans-serif',
          density: 'comfortable',
          baseCurrency: 'COP',
          customThemeJson: null,
          updatedAt: '',
        }),
      ),
      featureFlags: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    expect(api.accounts).toHaveBeenCalledOnce();
    expect(api.cards).toHaveBeenCalledOnce();
    expect(api.categories).toHaveBeenCalledOnce();
    expect(api.movements).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(api.notifications).toHaveBeenCalledOnce();
    expect(api.people).not.toHaveBeenCalled();
    expect(api.investments).not.toHaveBeenCalled();
    expect(api.preferences).not.toHaveBeenCalled();
    expect(api.featureFlags).toHaveBeenCalledOnce();
    expect(TestBed.inject(AppStore).remoteState()).toBe('ready');
    expect(TestBed.inject(AppStore).user()?.capabilities).toEqual(session.permissions);
  });

  it('con «ver movimientos» y nada más, los movimientos se piden', async () => {
    const api = {
      session: vi.fn(() => of({ ...session, permissions: [P.movimientos.ver] })),
      accounts: vi.fn(() => of([])),
      cards: vi.fn(() => of([])),
      categories: vi.fn(() => of([])),
      people: vi.fn(() => of([])),
      debts: vi.fn(() => of([])),
      investments: vi.fn(() => of([])),
      movements: vi.fn(() => of(emptyPage)),
      preferences: vi.fn(() => of(null)),
      featureFlags: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    expect(api.movements).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(api.accounts).not.toHaveBeenCalled();
    expect(api.people).not.toHaveBeenCalled();
    expect(api.investments).not.toHaveBeenCalled();
  });

  const apiCon = (sessionActual: () => unknown, extra: Record<string, unknown> = {}) => ({
    session: vi.fn(() => of(sessionActual())),
    movementKinds: vi.fn(() => of([])),
    accounts: vi.fn(() => of([])),
    cards: vi.fn(() => of([])),
    categories: vi.fn(() => of([])),
    people: vi.fn(() => of([{ id: 'p1', displayName: 'Camilo' }])),
    debts: vi.fn(() => of([])),
    investments: vi.fn(() => of([])),
    movements: vi.fn(() => of(emptyPage)),
    preferences: vi.fn(() => of(null)),
    featureFlags: vi.fn(() => of([])),
    notifications: vi.fn(() => of([])),
    ...extra,
  });

  const montar = (api: unknown) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    return TestBed.inject(RemoteBootstrap);
  };

  it('un cambio de permisos no recarga los datos que no cambian ni muestra la carga', async () => {
    const upgraded = { ...session, permissions: [...session.permissions, P.movimientos.crear] };
    let current = session;
    const api = apiCon(() => current);
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    const estados: string[] = [];
    const datosAntes = store.data();

    current = upgraded;
    await bootstrap.pollSession();
    estados.push(store.remoteState());

    expect(store.user()?.capabilities).toEqual(upgraded.permissions);
    expect(estados).toEqual(['ready']);
    expect(api.accounts).toHaveBeenCalledOnce();
    expect(api.movements).toHaveBeenCalledOnce();
    expect(store.data()).toBe(datosAntes);
  });

  it('un permiso recién concedido trae solo sus datos', async () => {
    const upgraded = { ...session, permissions: [...session.permissions, P.personas.ver] };
    let current = session;
    const api = apiCon(() => current);
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(api.people).not.toHaveBeenCalled();

    current = upgraded;
    await bootstrap.pollSession();

    expect(api.people).toHaveBeenCalledOnce();
    expect(api.accounts).toHaveBeenCalledOnce();
    expect(store.data().people.map((p) => p.name)).toEqual(['Camilo']);
    expect(store.remoteState()).toBe('ready');
  });

  it('un permiso retirado vacía sus datos sin volver a pedir nada', async () => {
    const withPeople = { ...session, permissions: [...session.permissions, P.personas.ver] };
    let current = withPeople;
    const api = apiCon(() => current);
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.data().people).toHaveLength(1);

    current = session;
    await bootstrap.pollSession();

    expect(store.data().people).toEqual([]);
    expect(api.people).toHaveBeenCalledOnce();
    expect(api.accounts).toHaveBeenCalledOnce();
    expect(store.remoteState()).toBe('ready');
  });

  it('un cambio de banderas se aplica sin recargar', async () => {
    let flags: { key: string; isEnabled: boolean }[] = [{ key: 'movements', isEnabled: true }];
    const api = apiCon(() => session, { featureFlags: vi.fn(() => of(flags)) });
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.featureFlags()['movements']).toBe(true);

    flags = [{ key: 'movements', isEnabled: false }];
    await bootstrap.pollSession();

    expect(store.featureFlags()['movements']).toBe(false);
    expect(api.accounts).toHaveBeenCalledOnce();
  });

  it('un error en una lista no anula la sesión', async () => {
    const api = apiCon(() => session, { accounts: vi.fn(() => throwError(() => new Error('boom'))) });
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);

    await bootstrap.initialize();

    expect(store.remoteState()).toBe('ready');
    expect(store.user()).not.toBeNull();
    expect(api.movements).toHaveBeenCalledOnce();
  });

  it('reloads when the identity changes even with the same permissions', async () => {
    const otherIdentity = {
      ...session,
      user: { ...session.user, id: 'u2', displayName: 'Otra persona' },
    };
    let current = session;
    const api = {
      session: vi.fn(() => of(current)),
      accounts: vi.fn(() => of([])),
      cards: vi.fn(() => of([])),
      categories: vi.fn(() => of([])),
      people: vi.fn(() => of([])),
      debts: vi.fn(() => of([])),
      investments: vi.fn(() => of([])),
      movements: vi.fn(() => of(emptyPage)),
      preferences: vi.fn(() => of(null)),
      featureFlags: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    const bootstrap = TestBed.inject(RemoteBootstrap);
    await bootstrap.initialize();
    await bootstrap.pollSession();
    current = otherIdentity;
    await bootstrap.pollSession();

    expect(api.accounts).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(AppStore).user()?.id).toBe('u2');
  });

  it('keeps money exact, derives the family from the published table and never invents a field', async () => {
    const ledgerSession = {
      ...session,
      permissions: [...session.permissions, P.movimientos.clases.listar, P.patrimonio.ver, P.personas.deudas.listar],
    };
    const money = (amount: string, currency = 'COP') => ({ amount, currency });
    const converted = (base: string, original: string, currency: string, rate: string) => ({
      base: money(base),
      original: money(original, currency),
      rate,
      rateAsOf: '2026-09-01',
    });
    const api = {
      session: vi.fn(() => of(ledgerSession)),
      movementKinds: vi.fn(() =>
        of([
          {
            kind: 21,
            allowedEffects: [],
            allowedFlows: [2],
            requiredLinks: [4],
            forbiddenLinks: [8],
            exactlyOneOfLinks: [],
            isAlwaysNeutral: true,
          },
          {
            kind: 2,
            allowedEffects: [2],
            allowedFlows: [2],
            requiredLinks: [],
            forbiddenLinks: [],
            exactlyOneOfLinks: [],
            isAlwaysNeutral: false,
          },
        ]),
      ),
      accounts: vi.fn(() => of([])),
      cards: vi.fn(() =>
        of([
          {
            id: 'c1',
            name: 'Visa',
            currency: 'USD',
            creditLimit: money('1500.55', 'USD'),
            cycle: { statementDay: 5, paymentDueDay: 20 },
            issuer: null,
            lastFour: null,
          },
        ]),
      ),
      categories: vi.fn(() => of([])),
      people: vi.fn(() => of([])),
      debts: vi.fn(() => of([])),
      investments: vi.fn(() =>
        of([
          {
            id: 'i1',
            name: 'CDT',
            instrumentType: 'Renta fija',
            currency: 'USD',
            costBasis: money('100.10', 'USD'),
            marketValue: money('100.20', 'USD'),
          },
        ]),
      ),
      movements: vi.fn(() =>
        of({
          items: [
            {
              id: 'm1',
              date: '2026-09-01',
              kind: 21,
              effect: 0,
              flow: 2,
              amount: converted('400000', '100.00', 'USD', '4000'),
              links: { card: 'c1' },
              linkNames: {},
              origin: 0,
              description: 'Pago de tarjeta',
              createdAt: '',
              reversalOf: null,
              reversedBy: null,
            },
            {
              id: 'm2',
              date: '2026-09-02',
              kind: 2,
              effect: 2,
              flow: 2,
              amount: converted('35000', '35000', 'COP', '1'),
              links: {},
              linkNames: {},
              origin: 0,
              description: 'Mercado',
              createdAt: '',
              reversalOf: null,
              reversedBy: null,
            },
          ],
          page: 1,
          size: 25,
          total: 2,
          totalPages: 1,
          hasNext: false,
        }),
      ),
      preferences: vi.fn(() => of(null)),
      featureFlags: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();
    const store = TestBed.inject(AppStore);
    const [pago, gasto] = store.data().movements;

    expect(api.movementKinds).toHaveBeenCalledOnce();
    expect(store.kindCatalog().size).toBe(2);
    expect(pago.kind).toBe('payment');
    expect(gasto.kind).toBe('expense');
    expect(pago.amount).toBe(-400000);

    expect(pago.originalAmount).toBe(100);
    expect(store.data().accounts[0].limit).toBe(1500.55);
    expect(store.data().investments[0].value - store.data().investments[0].cost).toBeCloseTo(0.1, 10);

    const inversion = store.data().investments[0];
    expect(inversion.risk).toBeUndefined();
    expect(inversion.liquidity).toBeUndefined();
    expect(inversion.institution).toBeUndefined();
    expect(inversion.units).toBeUndefined();
    expect(store.data().accounts[0].lastFour).toBeUndefined();
  });

  it('treats 401 as an anonymous visitor instead of a connection error', async () => {
    const api = {
      session: vi.fn(() => throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    const store = TestBed.inject(AppStore);
    expect(store.remoteState()).toBe('anonymous');
    expect(store.remoteError()).toBe('');
    expect(store.user()).toBeNull();
  });

  it('surfaces the failed Google callback instead of a silent anonymous state', async () => {
    window.history.pushState(null, '', '/dashboard?authError=1&foo=bar');
    const api = {
      session: vi.fn(() => throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    const store = TestBed.inject(AppStore);
    expect(store.remoteState()).toBe('error');
    expect(store.remoteError()).not.toBe('');
    expect(window.location.search).not.toContain('authError');
    expect(window.location.search).toContain('foo=bar');
    window.history.pushState(null, '', '/');
  });

  it('un 401 durante el refresco cierra la sesión en lugar de ignorarse', async () => {
    let caducada = false;
    const api = {
      ...apiCon(() => session),
      session: vi.fn(() =>
        caducada ? throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' })) : of(session),
      ),
    };
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.remoteState()).toBe('ready');
    expect(store.user()).not.toBeNull();

    caducada = true;
    await bootstrap.pollSession();

    expect(store.remoteState()).toBe('anonymous');
    expect(store.user()).toBeNull();
  });

  it('un error transitorio durante el refresco no cierra la sesión', async () => {
    let caida = false;
    const api = {
      ...apiCon(() => session),
      session: vi.fn(() => (caida ? throwError(() => new Error('red caída')) : of(session))),
    };
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();

    caida = true;
    await bootstrap.pollSession();

    expect(store.remoteState()).toBe('ready');
    expect(store.user()).not.toBeNull();
  });

  describe('moneda base y catálogo de monedas', () => {
    afterEach(() => {
      baseCurrency.set(BASE_CURRENCY);
      currencyCatalog.set(LOCAL_CURRENCIES);
    });

    it('toma la moneda base de la sesión en vez de dejar la de compilación', async () => {
      const sesionEnUsd = { ...session, organization: { ...session.organization, baseCurrency: 'USD' } };

      await montar(apiCon(() => sesionEnUsd)).initialize();

      expect(TestBed.inject(AppStore).baseCurrency()).toBe('USD');
    });

    it('ignora una moneda base que no sea un código de tres letras', async () => {
      const sesionRara = { ...session, organization: { ...session.organization, baseCurrency: 'US' } };

      await montar(apiCon(() => sesionRara)).initialize();

      expect(TestBed.inject(AppStore).baseCurrency()).toBe(BASE_CURRENCY);
    });

    it('pide el catálogo de monedas solo cuando su permiso está concedido', async () => {
      const conMonedas = { ...session, permissions: [...session.permissions, P.sesion.monedas.listar] };
      const currencies = vi.fn(() => of([{ code: 'USD', minorUnits: 2, isBase: false }]));
      const api = apiCon(() => conMonedas, { currencies });

      await montar(api).initialize();

      expect(currencies).toHaveBeenCalledOnce();
      expect(
        TestBed.inject(AppStore)
          .currencyCatalog()
          .map((moneda) => moneda.code),
      ).toContain('USD');
    });

    it('sin el permiso el catálogo no se pide', async () => {
      const currencies = vi.fn(() => of([]));
      const api = apiCon(() => session, { currencies });

      await montar(api).initialize();

      expect(currencies).not.toHaveBeenCalled();
    });

    it('un catálogo que no llega no impide que la sesión arranque', async () => {
      const conMonedas = { ...session, permissions: [...session.permissions, P.sesion.monedas.listar] };
      const currencies = vi.fn(() => throwError(() => new Error('sin red')));
      const api = apiCon(() => conMonedas, { currencies });

      await montar(api).initialize();

      expect(TestBed.inject(AppStore).remoteState()).toBe('ready');
      expect(currencyCatalog()).toEqual(LOCAL_CURRENCIES);
    });
  });
});
