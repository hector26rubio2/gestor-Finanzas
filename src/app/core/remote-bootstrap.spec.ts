import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from './api-client';
import { P } from './permissions';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { DemoStore } from './store';

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
    // La mascara numerica llega vacia, como en un rol granular: lo que decide que se pide
    // son los permisos, que es lo mismo que exige cada endpoint.
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
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
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
    expect(api.featureFlags).not.toHaveBeenCalled();
    expect(TestBed.inject(DemoStore).remoteState()).toBe('ready');
    expect(TestBed.inject(DemoStore).user()?.capabilities).toEqual(session.permissions);
  });

  it('con «ver movimientos» y nada más, los movimientos se piden', async () => {
    // El fallo tal como se reportó: quitar todos los permisos, dejar solo ese, y la
    // pantalla salía vacía. El menú y la ruta ya miraban el permiso; esta petición no,
    // miraba la máscara numérica, que un rol granular deja vacía.
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
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    expect(api.movements).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    // Y solo eso: un permiso concede su pantalla, no las de al lado.
    expect(api.accounts).not.toHaveBeenCalled();
    expect(api.people).not.toHaveBeenCalled();
    expect(api.investments).not.toHaveBeenCalled();
  });

  it('reloads everything when the session permissions change', async () => {
    const upgraded = {
      ...session,
      permissions: [...session.permissions, P.movimientos.crear],
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
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    const bootstrap = TestBed.inject(RemoteBootstrap);
    await bootstrap.initialize();
    await bootstrap.pollSession();
    current = upgraded;
    await bootstrap.pollSession();

    expect(api.session).toHaveBeenCalledTimes(4);
    expect(api.accounts).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(DemoStore).user()?.capabilities).toEqual(upgraded.permissions);
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
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();
    const store = TestBed.inject(DemoStore);
    const [pago, gasto] = store.data().movements;

    // A-2: la familia sale de la tabla publicada, no de un número escrito a mano.
    expect(api.movementKinds).toHaveBeenCalledOnce();
    expect(store.kindCatalog().size).toBe(2);
    expect(pago.kind).toBe('payment');
    expect(gasto.kind).toBe('expense');
    expect(pago.amount).toBe(-400000);

    // A-1: el importe en moneda original conserva los centavos sin polvo binario.
    expect(pago.originalAmount).toBe(100);
    expect(store.data().accounts[0].limit).toBe(1500.55);
    expect(store.data().investments[0].value - store.data().investments[0].cost).toBeCloseTo(0.1, 10);

    // A-3: lo que la API no publica llega ausente, no inventado.
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
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    const store = TestBed.inject(DemoStore);
    expect(store.remoteState()).toBe('anonymous');
    expect(store.remoteError()).toBe('');
    expect(store.user()).toBeNull();
  });
});
