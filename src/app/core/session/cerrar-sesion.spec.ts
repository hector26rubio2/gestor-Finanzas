import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api/api-client';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { AppStore } from '@core/state/store';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';

describe('cerrar sesion', () => {
  function montar(api: Partial<FinanceApiClient> = {}) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'dashboard', children: [] },
        ]),
        {
          provide: RUNTIME_CONFIG,
          useValue: { apiBaseUrl: 'https://api.example.test' },
        },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)), ...api } },
      ],
    });
    return TestBed.inject(RemoteBootstrap);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('si el servidor no responde, la sesion local se cierra igual', async () => {
    const logout = vi.fn(() => throwError(() => new Error('sin red')));
    const arranque = montar({ logout } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(AppStore);
    const router = TestBed.inject(Router);
    store.user.set(USUARIO_DE_PRUEBA);
    await router.navigateByUrl('/dashboard');

    await arranque.cerrarSesion();

    expect(logout).toHaveBeenCalled();
    expect(store.user()).toBeNull();
    expect(router.url).toBe('/login');
  });

  it('el sondeo no vuelve a entrar despues de cerrar sesion', async () => {
    const sesion = {
      user: { id: 'u1', displayName: 'Valentina', email: 'v@example.test', isActive: true },
      organization: { id: 'o1', name: 'Personal', slug: 'p', baseCurrency: 'COP', isActive: true, createdAt: '' },
      capabilities: [],
      organizations: [],
      expiresAt: '',
      permissions: ['dashboard.ver'],
    };
    const session = vi.fn(() => of(sesion));
    const arranque = montar({
      logout: vi.fn(() => of(void 0)),
      session,
    } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(AppStore);
    store.user.set(USUARIO_DE_PRUEBA);

    await arranque.cerrarSesion();
    const llamadasAlCerrar = session.mock.calls.length;

    await arranque.pollSession();

    expect(session.mock.calls.length).toBe(llamadasAlCerrar);
    expect(store.user()).toBeNull();
  });

  it('deja el estado en anonimo, no en cargando', async () => {
    const arranque = montar({
      logout: vi.fn(() => of(void 0)),
    } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(AppStore);
    store.user.set(USUARIO_DE_PRUEBA);

    await arranque.cerrarSesion();

    expect(store.remoteState()).toBe('anonymous');
  });

  it('cierra tambien la sesion del servidor cuando la hay', async () => {
    const logout = vi.fn(() => of(void 0));
    const arranque = montar({ logout } as unknown as Partial<FinanceApiClient>);
    TestBed.inject(AppStore).user.set(USUARIO_DE_PRUEBA);

    await arranque.cerrarSesion();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
