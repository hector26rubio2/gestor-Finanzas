import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBootstrap, ApiRequestError, FinanceApiClient } from '@core/api/api-client';
import { BASE_CURRENCY, baseCurrency, currencyCatalog, LOCAL_CURRENCIES } from '@core/utils/money';
import { arranqueDe } from '@testing/arranque-de-prueba';
import { P } from './permissions';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { ApiWritesBus } from '@core/api/api-writes';
import { AppStore } from '@core/state/store';

describe('RemoteBootstrap', () => {
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
  const money = (amount: string, currency = 'COP') => ({ amount, currency });

  beforeEach(() => TestBed.resetTestingModule());

  const apiCon = (arranque: () => ApiBootstrap, extra: Record<string, unknown> = {}) => ({
    bootstrap: vi.fn(() => of(arranque())),
    debts: vi.fn(() => of([])),
    investments: vi.fn(() => of([])),
    notifications: vi.fn(() => of([])),
    movements: vi.fn(),
    session: vi.fn(),
    accounts: vi.fn(),
    cards: vi.fn(),
    categories: vi.fn(),
    people: vi.fn(),
    preferences: vi.fn(),
    featureFlags: vi.fn(),
    currencies: vi.fn(),
    movementKinds: vi.fn(),
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

  it('arranca con una sola llamada y no pide nada más', async () => {
    const api = apiCon(() => arranqueDe(session, { accounts: [], cards: [], categories: [] }));

    await montar(api).initialize();

    expect(api.bootstrap).toHaveBeenCalledOnce();
    for (const sobrante of [
      api.session,
      api.accounts,
      api.cards,
      api.categories,
      api.people,
      api.preferences,
      api.featureFlags,
      api.currencies,
      api.movementKinds,
      api.movements,
      api.debts,
      api.investments,
      api.notifications,
    ])
      expect(sobrante).not.toHaveBeenCalled();
    expect(TestBed.inject(AppStore).remoteState()).toBe('ready');
    expect(TestBed.inject(AppStore).user()?.capabilities).toEqual(session.permissions);
  });

  it('movimientos e inversiones no se piden al arrancar', async () => {
    const api = apiCon(() => arranqueDe(session));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);

    await bootstrap.initialize();

    expect(store.data().movements).toEqual([]);
    expect(store.movimientosListos()).toBe(false);
    expect(api.investments).not.toHaveBeenCalled();
  });

  it('los avisos del arranque dan el contador y la lista reciente sin pedir nada más', async () => {
    const aviso = {
      id: 'a',
      kind: 'k',
      title: 'a',
      payloadJson: '{}',
      readAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const api = apiCon(() => arranqueDe(session, { notifications: { unreadCount: 5, latest: [aviso] } }));
    await montar(api).initialize();
    const store = TestBed.inject(AppStore);

    expect(store.unread()).toBe(5);
    expect(store.avisosRecientes()).toEqual([aviso]);
    expect(api.notifications).not.toHaveBeenCalled();
  });

  it('sin el permiso de inversiones no se piden', async () => {
    const api = apiCon(() => arranqueDe(session));
    const bootstrap = montar(api);
    await bootstrap.initialize();

    await bootstrap.asegurar('investments');

    expect(api.investments).not.toHaveBeenCalled();
  });

  it('las inversiones se piden al necesitarlas y conservan los movimientos ya cargados', async () => {
    const conPatrimonio = { ...session, permissions: [...session.permissions, P.patrimonio.ver] };
    const api = apiCon(() => arranqueDe(conPatrimonio), {
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
    });
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    store.data.update((data) => ({ ...data, movements: [{ id: 'm1' } as never] }));

    await bootstrap.asegurar('investments');

    expect(store.data().investments.map((i) => i.name)).toEqual(['CDT']);
    expect(store.data().movements.map((m) => m.id)).toEqual(['m1']);
    const inversion = store.data().investments[0];
    expect(inversion.value - inversion.cost).toBeCloseTo(0.1, 10);
    expect(inversion.risk).toBeUndefined();
    expect(inversion.institution).toBeUndefined();
  });

  it('una escritura recarga las inversiones ya cargadas', async () => {
    const conPatrimonio = { ...session, permissions: [...session.permissions, P.patrimonio.ver] };
    const investments = vi.fn(() => of([]));
    const api = apiCon(() => arranqueDe(conPatrimonio), { investments });
    const bootstrap = montar(api);
    await bootstrap.initialize();
    await bootstrap.asegurar('investments');
    TestBed.tick();

    TestBed.inject(ApiWritesBus).notify();
    TestBed.tick();
    await vi.waitFor(() => expect(investments).toHaveBeenCalledTimes(2));
  });

  it('una escritura no pide inversiones que nunca se cargaron', async () => {
    const conPatrimonio = { ...session, permissions: [...session.permissions, P.patrimonio.ver] };
    const api = apiCon(() => arranqueDe(conPatrimonio));
    const bootstrap = montar(api);
    await bootstrap.initialize();
    TestBed.tick();

    TestBed.inject(ApiWritesBus).notify();
    TestBed.tick();

    expect(api.investments).not.toHaveBeenCalled();
  });

  it('un fallo al cargar bajo demanda avisa y se reintenta en la siguiente entrada', async () => {
    const conPatrimonio = { ...session, permissions: [...session.permissions, P.patrimonio.ver] };
    const investments = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValue(of([]));
    const api = apiCon(() => arranqueDe(conPatrimonio), { investments });
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();

    await bootstrap.asegurar('investments');
    expect(store.toast.texto()).not.toBe('');
    await bootstrap.asegurar('investments');

    expect(investments).toHaveBeenCalledTimes(2);
  });

  it('los saldos del arranque quedan como saldos del servidor, con las tarjetas en negativo', async () => {
    const api = apiCon(() =>
      arranqueDe(session, {
        balances: {
          asOf: '2026-10-08',
          accounts: [{ account: { id: 'a1', name: 'Ahorros' }, balance: money('1500'), asOf: '2026-10-08' }],
          cards: [{ cardId: 'c1', debt: money('300') }],
        },
      }),
    );

    await montar(api).initialize();

    const saldos = TestBed.inject(AppStore).saldosDelServidor();
    expect(saldos?.get('a1')).toBe(1500);
    expect(saldos?.get('c1')).toBe(-300);
  });

  it('un cambio de permisos no recarga los datos que no cambian ni muestra la carga', async () => {
    const upgraded = { ...session, permissions: [...session.permissions, P.movimientos.crear] };
    let current = session;
    const api = apiCon(() => arranqueDe(current, { accounts: [] }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    const datosAntes = store.data();

    current = upgraded;
    await bootstrap.pollSession();

    expect(store.user()?.capabilities).toEqual(upgraded.permissions);
    expect(store.remoteState()).toBe('ready');
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
    expect(store.data()).toBe(datosAntes);
  });

  it('un permiso recién concedido trae sus datos en el mismo viaje', async () => {
    const upgraded = { ...session, permissions: [...session.permissions, P.personas.ver] };
    let current = session;
    let personas: ApiBootstrap['people'] = null;
    const api = apiCon(() => arranqueDe(current, { people: personas }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();

    current = upgraded;
    personas = [{ id: 'p1', displayName: 'Camilo' } as never];
    await bootstrap.pollSession();

    expect(store.data().people.map((p) => p.name)).toEqual(['Camilo']);
    expect(store.remoteState()).toBe('ready');
  });

  it('un permiso retirado vacía sus datos', async () => {
    const withPeople = { ...session, permissions: [...session.permissions, P.personas.ver] };
    let current = withPeople;
    let personas: ApiBootstrap['people'] = [{ id: 'p1', displayName: 'Camilo' } as never];
    const api = apiCon(() => arranqueDe(current, { people: personas }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.data().people).toHaveLength(1);

    current = session;
    personas = null;
    await bootstrap.pollSession();

    expect(store.data().people).toEqual([]);
    expect(store.remoteState()).toBe('ready');
  });

  it('un cambio de banderas se aplica sin recargar', async () => {
    let flags: { key: string; isEnabled: boolean; audienceJson: null; updatedAt: string }[] = [
      { key: 'movements', isEnabled: true, audienceJson: null, updatedAt: '' },
    ];
    const api = apiCon(() => arranqueDe(session, { featureFlags: flags }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.featureFlags()['movements']).toBe(true);

    flags = [{ key: 'movements', isEnabled: false, audienceJson: null, updatedAt: '' }];
    await bootstrap.pollSession();

    expect(store.featureFlags()['movements']).toBe(false);
  });

  it('una parte que el servidor no pudo entregar avisa pero no anula la sesión', async () => {
    const api = apiCon(() => arranqueDe(session, { omitted: [{ part: 'accounts', reason: 'failed' }] }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);

    await bootstrap.initialize();

    expect(store.remoteState()).toBe('ready');
    expect(store.user()).not.toBeNull();
    expect(store.toast.texto()).not.toBe('');
  });

  it('una parte prohibida se omite sin avisar', async () => {
    const api = apiCon(() => arranqueDe(session, { omitted: [{ part: 'people', reason: 'forbidden' }] }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);

    await bootstrap.initialize();

    expect(store.remoteState()).toBe('ready');
    expect(store.toast.texto()).toBe('');
  });

  it('una parte fallida durante el refresco conserva lo que ya había', async () => {
    let omitidas: ApiBootstrap['omitted'] = [];
    let personas: ApiBootstrap['people'] = [{ id: 'p1', displayName: 'Camilo' } as never];
    const api = apiCon(() => arranqueDe(session, { people: personas, omitted: omitidas }));
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();

    personas = null;
    omitidas = [{ part: 'people', reason: 'failed' }];
    await bootstrap.pollSession();

    expect(store.data().people.map((p) => p.name)).toEqual(['Camilo']);
  });

  it('sin banderas el arranque se considera fallido', async () => {
    const api = apiCon(() => arranqueDe(session, { featureFlags: null }));
    const bootstrap = montar(api);

    await bootstrap.initialize();

    expect(TestBed.inject(AppStore).remoteState()).toBe('error');
  });

  it('reloads when the identity changes even with the same permissions', async () => {
    const otherIdentity = {
      ...session,
      user: { ...session.user, id: 'u2', displayName: 'Otra persona' },
    };
    let current = session;
    const api = apiCon(() => arranqueDe(current));
    const bootstrap = montar(api);

    await bootstrap.initialize();
    await bootstrap.pollSession();
    current = otherIdentity;
    await bootstrap.pollSession();

    expect(api.bootstrap).toHaveBeenCalledTimes(4);
    expect(TestBed.inject(AppStore).user()?.id).toBe('u2');
  });

  it('keeps money exact and derives the family from the published table', async () => {
    const ledgerSession = { ...session, permissions: [...session.permissions, P.movimientos.clases.listar] };
    const api = apiCon(() =>
      arranqueDe(ledgerSession, {
        movementKinds: [
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
        ],
        cards: [
          {
            id: 'c1',
            name: 'Visa',
            currency: 'USD',
            creditLimit: money('1500.55', 'USD'),
            cycle: { statementDay: 5, paymentDueDay: 20 },
            issuer: null,
            lastFour: null,
            isActive: true,
          } as never,
        ],
      }),
    );

    await montar(api).initialize();
    const store = TestBed.inject(AppStore);

    expect(store.kindCatalog().size).toBe(2);
    expect(store.data().accounts[0].limit).toBe(1500.55);
    expect(store.data().accounts[0].lastFour).toBeUndefined();
  });

  it('treats 401 as an anonymous visitor instead of a connection error', async () => {
    const api = {
      bootstrap: vi.fn(() => throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))),
    };

    await montar(api).initialize();

    const store = TestBed.inject(AppStore);
    expect(store.remoteState()).toBe('anonymous');
    expect(store.remoteError()).toBe('');
    expect(store.user()).toBeNull();
  });

  it('surfaces the failed Google callback instead of a silent anonymous state', async () => {
    window.history.pushState(null, '', '/dashboard?authError=1&foo=bar');
    const api = {
      bootstrap: vi.fn(() => throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))),
    };

    await montar(api).initialize();

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
      ...apiCon(() => arranqueDe(session)),
      bootstrap: vi.fn(() =>
        caducada
          ? throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))
          : of(arranqueDe(session)),
      ),
    };
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();
    expect(store.remoteState()).toBe('ready');

    caducada = true;
    await bootstrap.pollSession();

    expect(store.remoteState()).toBe('anonymous');
    expect(store.user()).toBeNull();
  });

  it('un error transitorio durante el refresco no cierra la sesión', async () => {
    let caida = false;
    const api = {
      ...apiCon(() => arranqueDe(session)),
      bootstrap: vi.fn(() => (caida ? throwError(() => new Error('red caída')) : of(arranqueDe(session)))),
    };
    const bootstrap = montar(api);
    const store = TestBed.inject(AppStore);
    await bootstrap.initialize();

    caida = true;
    await bootstrap.pollSession();

    expect(store.remoteState()).toBe('ready');
    expect(store.user()).not.toBeNull();
  });

  describe('al volver a la ventana', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('no revisa la sesión antes del intervalo mínimo ni por reloj', async () => {
      const api = apiCon(() => arranqueDe(session));
      const bootstrap = montar(api);
      await bootstrap.start();
      expect(api.bootstrap).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(api.bootstrap).toHaveBeenCalledOnce();

      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
      expect(api.bootstrap).toHaveBeenCalledTimes(2);

      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
      expect(api.bootstrap).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(61_000);
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
      expect(api.bootstrap).toHaveBeenCalledTimes(3);
    });
  });

  describe('moneda base y catálogo de monedas', () => {
    afterEach(() => {
      baseCurrency.set(BASE_CURRENCY);
      currencyCatalog.set(LOCAL_CURRENCIES);
    });

    it('toma la moneda base de la sesión en vez de dejar la de compilación', async () => {
      const sesionEnUsd = { ...session, organization: { ...session.organization, baseCurrency: 'USD' } };

      await montar(apiCon(() => arranqueDe(sesionEnUsd))).initialize();

      expect(TestBed.inject(AppStore).baseCurrency()).toBe('USD');
    });

    it('ignora una moneda base que no sea un código de tres letras', async () => {
      const sesionRara = { ...session, organization: { ...session.organization, baseCurrency: 'US' } };

      await montar(apiCon(() => arranqueDe(sesionRara))).initialize();

      expect(TestBed.inject(AppStore).baseCurrency()).toBe(BASE_CURRENCY);
    });

    it('usa el catálogo de monedas que trae el arranque', async () => {
      const currencies = [{ code: 'USD', minorUnits: 2, isBase: false }];

      await montar(apiCon(() => arranqueDe(session, { currencies }))).initialize();

      expect(
        TestBed.inject(AppStore)
          .currencyCatalog()
          .map((moneda) => moneda.code),
      ).toContain('USD');
    });

    it('sin catálogo en el arranque se conserva el local', async () => {
      await montar(apiCon(() => arranqueDe(session))).initialize();

      expect(currencyCatalog()).toEqual(LOCAL_CURRENCIES);
      expect(TestBed.inject(AppStore).remoteState()).toBe('ready');
    });
  });
});
