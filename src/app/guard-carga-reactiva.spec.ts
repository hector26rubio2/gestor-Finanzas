import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppStore } from '@core/state';
import { P, RUNTIME_CONFIG } from '@core/session';
import { routes } from './routes';

/**
 * Rama reactiva del guard (routes.ts, `store.remoteState() === 'loading'`):
 * mientras la sesión remota está en vuelo, el guard no decide nada, no deja
 * pasar la navegación y espera el primer estado ya resuelto para decidir
 * con la información congelada de ese momento.
 */
describe('guard de rutas: estado remoto en vuelo', () => {
  const guardDe = (path: string) => {
    const ruta = routes.find((r) => r.path === path);
    const guard = ruta?.canMatch?.[0] as CanMatchFn | undefined;
    if (typeof guard !== 'function') throw new Error(`la ruta ${path} no tiene guard`);
    return () =>
      TestBed.runInInjectionContext(() => guard({ path, data: {} } as never, [], {} as never)) as
        boolean | UrlTree | Observable<boolean | UrlTree>;
  };

  const montar = (permisos: readonly string[] = [], banderas: Record<string, boolean> = {}) => {
    TestBed.configureTestingModule({
      providers: [{ provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } }],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ id: 'u1', name: 'Lectora', email: 'l@example.test', capabilities: [...permisos] } as never);
    store.featureFlags.set(banderas);
    store.featureFlagsLoaded.set(true);
    store.remoteState.set('loading');
    return store;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('mientras carga, el guard no emite ninguna decisión: ni deja pasar ni manda fuera', () => {
    const store = montar([P.dashboard.ver], { dashboard: true });
    const resultado = guardDe('dashboard')();
    expect(resultado instanceof Observable).toBe(true);

    const decisiones: unknown[] = [];
    (resultado as Observable<unknown>).subscribe((v) => decisiones.push(v));
    TestBed.tick();

    expect(decisiones).toEqual([]); // nada pasó todavía, y la navegación tampoco
    expect(store.remoteState()).toBe('loading');
  });

  it('cuando la sesión ya está decidida como error, la espera termina y manda al login', async () => {
    const store = montar();
    store.user.set(null);
    store.remoteState.set('loading');

    const decision = guardDe('dashboard')() as Observable<boolean | UrlTree>;
    store.remoteState.set('error');
    TestBed.tick();

    const destino = await new Promise<boolean | UrlTree>((resolver) => decision.subscribe(resolver));
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/login');
  });

  it('un permiso concedido mientras aún carga no adelanta la decisión: vale lo que valga al estar listo', async () => {
    const store = montar([], {});
    const decision = guardDe('dashboard')() as Observable<boolean | UrlTree>;
    TestBed.tick();

    store.user.set({ id: 'u1', name: 'L', email: 'l@example.test', capabilities: [P.dashboard.ver] } as never);
    TestBed.tick();
    expect(store.user()).not.toBeNull(); // el permiso llegó durante la carga...

    store.remoteState.set('ready');
    TestBed.tick();
    const destino = await new Promise<boolean | UrlTree>((resolver) => decision.subscribe(resolver));
    // ...pero la decisión se toma con el estado al momento de resolver: la bandera
    // de la sección sigue cerrada, así que no deja entrar
    expect(destino instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/sin-acceso');
  });

  it('la espera no se queda colgada: al llegar a un estado final decide una vez y termina', async () => {
    const store = montar([P.dashboard.ver], { dashboard: true });
    const decision = guardDe('dashboard')() as Observable<boolean | UrlTree>;

    const decisiones: Array<boolean | UrlTree> = [];
    decision.subscribe((v) => decisiones.push(v));
    store.remoteState.set('ready');
    TestBed.tick();
    store.remoteState.set('anonymous');
    TestBed.tick();

    await new Promise((resolucion) => setTimeout(resolucion, 0));
    expect(decisiones.length).toBe(1); // un solo veredicto, y luego el guard quedó fuera
    expect(decisiones[0]).toBe(true);
  });
});
