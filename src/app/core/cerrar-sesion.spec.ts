import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from './api-client';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { DemoStore } from './store';

/**
 * Cerrar sesion estaba escrito dos veces —el menu de perfil y Preferencias— y las copias
 * habian divergido: la de Preferencias no olvidaba el perfil demo, asi que en modo local
 * seguias dentro, y si la llamada al servidor fallaba se rendia sin limpiar nada.
 */
describe('cerrar sesion', () => {
  function montar(mode: 'demo' | 'api', api: Partial<FinanceApiClient> = {}) {
    window.__FINANZAS_CONFIG__ = mode === 'api' ? { mode, apiBaseUrl: 'https://api.example.test' } : { mode };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'dashboard', children: [] },
        ]),
        {
          provide: RUNTIME_CONFIG,
          useValue: mode === 'api' ? { mode, apiBaseUrl: 'https://api.example.test' } : { mode },
        },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)), ...api } },
      ],
    });
    return TestBed.inject(RemoteBootstrap);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('lleva a la pantalla de acceso y olvida el perfil local', async () => {
    const arranque = montar('demo');
    const store = TestBed.inject(DemoStore);
    const router = TestBed.inject(Router);
    store.user.set(store.users[0]);
    sessionStorage.setItem('finanzas.demo.perfil', '0');
    await router.navigateByUrl('/dashboard');

    await arranque.cerrarSesion();

    expect(router.url).toBe('/login');
    expect(store.user()).toBeNull();
    // Sin esto, en modo local la siguiente carga volvia a entrar sola.
    expect(sessionStorage.getItem('finanzas.demo.perfil')).toBeNull();
  });

  it('si el servidor no responde, la sesion local se cierra igual', async () => {
    const logout = vi.fn(() => throwError(() => new Error('sin red')));
    const arranque = montar('api', { logout } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(DemoStore);
    const router = TestBed.inject(Router);
    store.user.set(store.users[0]);
    await router.navigateByUrl('/dashboard');

    await arranque.cerrarSesion();

    // Quedarse dentro porque la red fallo es lo contrario de lo que se pidio.
    expect(logout).toHaveBeenCalled();
    expect(store.user()).toBeNull();
    expect(router.url).toBe('/login');
  });

  it('el sondeo no vuelve a entrar despues de cerrar sesion', async () => {
    // Esto es lo que se veia: se cerraba sesion, el sondeo seguia corriendo, la
    // siguiente lectura devolvia una sesion todavia viva y la aplicacion entraba sola.
    const sesion = {
      user: { id: 'u1', displayName: 'Valentina', email: 'v@example.test', isActive: true },
      organization: { id: 'o1', name: 'Personal', slug: 'p', baseCurrency: 'COP', isActive: true, createdAt: '' },
      capabilities: [],
      organizations: [],
      expiresAt: '',
      permissions: ['dashboard.ver'],
    };
    const session = vi.fn(() => of(sesion));
    const arranque = montar('api', {
      logout: vi.fn(() => of(void 0)),
      session,
    } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(DemoStore);
    store.user.set(store.users[0]);

    await arranque.cerrarSesion();
    const llamadasAlCerrar = session.mock.calls.length;

    await arranque.pollSession();

    // Ni siquiera pregunta: la sesion se cerro a proposito.
    expect(session.mock.calls.length).toBe(llamadasAlCerrar);
    expect(store.user()).toBeNull();
  });

  it('deja el estado en anonimo, no en cargando', async () => {
    const arranque = montar('api', {
      logout: vi.fn(() => of(void 0)),
    } as unknown as Partial<FinanceApiClient>);
    const store = TestBed.inject(DemoStore);
    store.user.set(store.users[0]);

    await arranque.cerrarSesion();

    // Con «loading» la pantalla de carga se quedaria puesta sobre el login.
    expect(store.remoteState()).toBe('anonymous');
  });

  it('cierra tambien la sesion del servidor cuando la hay', async () => {
    const logout = vi.fn(() => of(void 0));
    const arranque = montar('api', { logout } as unknown as Partial<FinanceApiClient>);
    TestBed.inject(DemoStore).user.set(TestBed.inject(DemoStore).users[0]);

    await arranque.cerrarSesion();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
