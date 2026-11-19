import { CanMatchFn, Router, UrlTree, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBootstrap, ApiSession, FinanceApiClient } from '@core/api/api-client';
import { CAPABILITIES, AppStore, navigation } from '@core/state';
import { P, RUNTIME_CONFIG, RemoteBootstrap } from '@core/session';
import { arranqueDe } from '@testing/arranque-de-prueba';
import { routes } from './routes';

const base: ApiSession = {
  user: { id: 'u1', displayName: 'Lectora', email: 'lectora@example.test', isActive: true },
  organization: { id: 'o1', name: 'Personal', slug: 'personal', baseCurrency: 'COP', isActive: true, createdAt: '' },
  capabilities: [],
  organizations: [],
  expiresAt: '',
  permissions: [P.dashboard.ver, P.movimientos.ver, P.cuentas.ver],
} as unknown as ApiSession;

const sesionCon = (permisos: string[]): ApiSession => ({ ...base, permissions: permisos }) as ApiSession;

const BANDERAS = ['dashboard', 'movements', 'accounts'].map((key) => ({
  key,
  isEnabled: true,
  audienceJson: null,
  updatedAt: '',
}));

class CanalFalso {
  static ultimo: CanalFalso | null = null;
  private readonly oyentes = new Map<string, () => void>();
  constructor(readonly url: string) {
    CanalFalso.ultimo = this;
  }
  addEventListener(tipo: string, oyente: () => void) {
    this.oyentes.set(tipo, oyente);
  }
  close() {}
  emitir(tipo: string) {
    this.oyentes.get(tipo)?.();
  }
}

describe('quitar un permiso con la sesión abierta oculta la sección sin recargar', () => {
  let actual: ApiSession;
  let api: { bootstrap: ReturnType<typeof vi.fn> };

  const guardDe = (path: string) => {
    const ruta = routes.find((r) => r.path === path);
    const guard = ruta?.canMatch?.[0] as CanMatchFn;
    return () => TestBed.runInInjectionContext(() => guard({ path, data: {} } as never, [], {} as never));
  };

  const destinoDe = (path: string) => {
    const resultado = guardDe(path)();
    return resultado === true ? true : TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  };

  const menuAbierto = () => {
    const capacidades = TestBed.inject(CAPABILITIES);
    return navigation.filter((entrada) => capacidades.allows(entrada.capability)).map((entrada) => entrada.path);
  };

  async function iniciar(permisos: string[]) {
    actual = sesionCon(permisos);
    api = {
      bootstrap: vi.fn(() => of(arranqueDe(actual, { featureFlags: BANDERAS }) as ApiBootstrap)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    const arranque = TestBed.inject(RemoteBootstrap);
    await arranque.initialize();
    return arranque;
  }

  beforeEach(() => {
    CanalFalso.ultimo = null;
    vi.stubGlobal('EventSource', CanalFalso);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('con el permiso la sección abre y aparece en el menú', async () => {
    await iniciar([P.dashboard.ver, P.movimientos.ver]);

    expect(destinoDe('movements')).toBe(true);
    expect(menuAbierto()).toEqual(['dashboard', 'movements']);
  });

  it('al retirarlo y volver a revisar la sesión, la sección sale del menú y la ruta redirige', async () => {
    const arranque = await iniciar([P.dashboard.ver, P.movimientos.ver]);

    actual = sesionCon([P.dashboard.ver]);
    await arranque.pollSession();

    expect(menuAbierto()).toEqual(['dashboard']);
    expect(destinoDe('movements')).toBe('/dashboard');
    expect(TestBed.inject(AppStore).remoteState()).toBe('ready');
  });

  it('el aviso en vivo de cambio de permisos dispara la revisión sin recargar la página', async () => {
    await iniciar([P.dashboard.ver, P.movimientos.ver]);
    expect(api.bootstrap).toHaveBeenCalledTimes(1);
    expect(CanalFalso.ultimo?.url).toContain('/api/v1/events');

    actual = sesionCon([P.dashboard.ver]);
    CanalFalso.ultimo?.emitir('permisos');
    await vi.waitFor(() => expect(api.bootstrap).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(menuAbierto()).toEqual(['dashboard']));
    expect(destinoDe('movements')).toBe('/dashboard');
  });

  it('si se retiran todas las secciones el guard manda a la pantalla que lo explica', async () => {
    const arranque = await iniciar([P.dashboard.ver]);

    actual = sesionCon([]);
    await arranque.pollSession();

    expect(menuAbierto()).toEqual([]);
    expect(destinoDe('dashboard')).toBe('/sin-acceso');
  });

  it('volver a concederlo reabre la sección sin recargar', async () => {
    const arranque = await iniciar([P.dashboard.ver]);
    expect(destinoDe('movements')).toBe('/dashboard');

    actual = sesionCon([P.dashboard.ver, P.movimientos.ver]);
    await arranque.pollSession();

    expect(destinoDe('movements')).toBe(true);
    expect(menuAbierto()).toEqual(['dashboard', 'movements']);
  });

  it('un cambio que no toca los permisos no mueve el menú', async () => {
    const arranque = await iniciar([P.dashboard.ver, P.movimientos.ver]);
    const antes = menuAbierto();

    await arranque.pollSession();

    expect(menuAbierto()).toEqual(antes);
  });
});
