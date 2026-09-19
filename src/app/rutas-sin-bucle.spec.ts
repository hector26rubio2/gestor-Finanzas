import { CanMatchFn, Router, UrlTree, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAPABILITIES, AppStore, FEATURES } from './core/state/store';
import { P } from './core/session/permissions';
import { RUNTIME_CONFIG } from './core/session/runtime';
import { routes } from './routes';

/**
 * El guard nunca puede mandar a una ruta que el propio guard cierra.
 *
 * Con la lista de banderas vacía —una instalación sin catálogo la devuelve así— toda
 * sección queda cerrada en modo API, y el rebote fijo a `/dashboard` se mandaba a sí
 * mismo sin parar: el hilo del navegador se quedaba girando en el bucle de
 * redirecciones y la pestaña dejaba de responder, sin un error en consola que lo dijera.
 */
describe('guard de rutas: sin sección abierta no hay rebote infinito', () => {
  const guardDe = (path: string) => {
    const ruta = routes.find((r) => r.path === path);
    const guard = ruta?.canMatch?.[0] as CanMatchFn | undefined;
    if (typeof guard !== 'function') throw new Error(`la ruta ${path} no tiene guard`);
    return () => TestBed.runInInjectionContext(() => guard({ path, data: {} } as never, [], {} as never));
  };

  const montar = (permisos: readonly string[], banderas: Record<string, boolean>, cargadas = true) => {
    TestBed.configureTestingModule({
      providers: [{ provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } }],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ id: 'u1', name: 'Lectora', email: 'l@example.test', capabilities: [...permisos] } as never);
    store.featureFlags.set(banderas);
    store.featureFlagsLoaded.set(cargadas);
    // El guard corre cuando el arranque ya terminó; mientras carga, espera (ver más abajo).
    store.remoteState.set('ready');
    return store;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('manda a la pantalla que lo explica cuando ninguna sección está abierta', () => {
    montar([P.dashboard.ver], {});
    const destino = guardDe('dashboard')();
    expect(destino).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/sin-acceso');
  });

  it('deja entrar cuando el permiso y la bandera acompañan', () => {
    montar([P.dashboard.ver], { dashboard: true });
    expect(guardDe('dashboard')()).toBe(true);
  });

  it('manda a la primera sección abierta cuando la pedida está cerrada', () => {
    montar([P.dashboard.ver, P.movimientos.ver], { movements: true });
    const destino = guardDe('dashboard')();
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/movements');
  });

  it('la pantalla de aviso no está guardada: es donde el bucle termina', () => {
    expect(routes.find((r) => r.path === 'sin-acceso')?.canMatch).toBeUndefined();
  });

  it('sin sesión sigue mandando a la pantalla de acceso', () => {
    montar([], {});
    TestBed.inject(AppStore).user.set(null);
    const destino = guardDe('dashboard')();
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/login');
  });

  it('el catálogo y los permisos deciden juntos: sin permiso no basta la bandera', () => {
    montar([], { dashboard: true });
    expect(TestBed.inject(CAPABILITIES).allows(P.dashboard.ver)).toBe(false);
    expect(TestBed.inject(FEATURES).enabled('dashboard')).toBe(true);
    const destino = guardDe('dashboard')();
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/sin-acceso');
  });

  it('espera a que termine la carga de la sesión antes de decidir', async () => {
    // Al recargar, el usuario y las banderas aún no llegaron: decidir entonces cerraba rutas
    // abiertas y mandaba al login o al dashboard, perdiendo la vista en la que se estaba.
    const store = montar([P.dashboard.ver], { dashboard: true });
    store.remoteState.set('loading');

    const resultado = guardDe('dashboard')();
    expect(isObservable(resultado)).toBe(true);

    const decision = firstValueFrom(resultado as Observable<boolean | UrlTree>);
    store.remoteState.set('ready');
    TestBed.tick();
    expect(await decision).toBe(true);
  });

  it('sin sesión manda al login recordando la ruta pedida, con su consulta', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.remoteState.set('ready');
    store.user.set(null);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/movements?pagina=3');

    expect(router.url).toBe('/login?returnUrl=%2Fmovements%3Fpagina%3D3');
  });

  it('sin sesión y sin una vista concreta, el login queda limpio, sin consulta', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.remoteState.set('ready');
    store.user.set(null);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/dashboard');

    expect(router.url).toBe('/login');
  });
});
