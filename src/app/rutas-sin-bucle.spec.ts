import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAPABILITIES, DemoStore, FEATURES } from './core/store';
import { P } from './core/permissions';
import { RUNTIME_CONFIG } from './core/runtime';
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
    const store = TestBed.inject(DemoStore);
    store.user.set({ id: 'u1', name: 'Lectora', email: 'l@example.test', capabilities: [...permisos] } as never);
    store.featureFlags.set(banderas);
    store.featureFlagsLoaded.set(cargadas);
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
    TestBed.inject(DemoStore).user.set(null);
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
});
