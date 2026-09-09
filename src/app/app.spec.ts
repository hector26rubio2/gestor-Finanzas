import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app';
import { FinanceApiClient } from './core/api-client';
import { P } from './core/permissions';
import { RUNTIME_CONFIG } from './core/runtime';
import { DemoStore } from './core/store';

/**
 * El armazón de la aplicación y la pantalla de entrada.
 *
 * Se decidía solo con `store.user()`, y eso pintaba el login dentro del layout: al
 * recargar contra la API la sesión tarda, el guard manda a `/login` mientras no hay
 * usuario, y al resolverse la sesión aparecía el armazón alrededor de una pantalla de
 * entrada que ya no hacía falta.
 */
describe('AppComponent y la pantalla de entrada', () => {
  function montar() {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'dashboard', children: [] },
          { path: 'movements', children: [] },
        ]),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)) } },
      ],
    });
    return TestBed.createComponent(AppComponent);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('no envuelve el login con el armazón, aunque ya haya usuario', async () => {
    const fixture = montar();
    const store = TestBed.inject(DemoStore);
    store.user.set({ ...store.users[0], capabilities: [P.dashboard.ver, P.dashboard.listar] });

    await TestBed.inject(Router).navigateByUrl('/login');
    fixture.detectChanges();

    expect(fixture.componentInstance.enLogin()).toBe(true);
    // Sin esto se veía la barra lateral y la superior alrededor del formulario.
    expect(fixture.nativeElement.querySelector('aside')).toBeNull();
    expect(fixture.nativeElement.querySelector('.topbar')).toBeNull();
  });

  it('fuera del login el armazón vuelve', async () => {
    const fixture = montar();
    const store = TestBed.inject(DemoStore);
    store.user.set({ ...store.users[0], capabilities: [P.dashboard.ver, P.dashboard.listar] });

    await TestBed.inject(Router).navigateByUrl('/dashboard');
    fixture.detectChanges();

    expect(fixture.componentInstance.enLogin()).toBe(false);
    expect(fixture.nativeElement.querySelector('aside')).not.toBeNull();
  });

  it('al resolverse la sesión sobre /login se sale a la primera ruta permitida', async () => {
    const fixture = montar();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    fixture.detectChanges();

    // Sin dashboard.ver, ir a /dashboard a ciegas devolvería al mismo sitio por el guard.
    const store = TestBed.inject(DemoStore);
    store.user.set({ ...store.users[0], capabilities: [P.movimientos.ver] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/movements');
  });
});

describe('AppComponent y el menú', () => {
  function montar() {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', children: [] }]),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)) } },
      ],
    });
    return TestBed.createComponent(AppComponent);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('un solo control abre y cierra, en vez de dos botones con dos significados', () => {
    const componente = montar().componentInstance;

    // En pantalla ancha «abrir» es que el panel no esté contraído.
    expect(componente.menuAbierto()).toBe(true);
    componente.alternarMenu();
    expect(componente.menuAbierto()).toBe(false);
    componente.alternarMenu();
    expect(componente.menuAbierto()).toBe(true);
  });
});
