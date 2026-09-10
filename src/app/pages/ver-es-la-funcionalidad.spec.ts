import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../core/api-client';
import { P } from '../core/permissions';
import { CAPABILITIES, DemoStore, navigation } from '../core/store';
import { RUNTIME_CONFIG } from '../core/runtime';
import { DashboardComponent } from './dashboard';

/**
 * Marcar la funcionalidad tiene que hacer que funcione.
 *
 * Durante un tiempo cada pantalla necesitaba dos permisos: `X.ver` para entrar y
 * `X.listar` para recibir su contenido. Conceder solo el primero —que es lo que hace
 * cualquiera al leer «ver movimientos»— ponía la entrada en el menú lateral y dentro no
 * había nada, sin decir por qué. Y en el dashboard, conceder «ver» más un KPI concreto
 * escondía justamente ese KPI: faltaba el segundo permiso, que nada anunciaba.
 *
 * Estas pruebas fijan la regla de ahora: `X.ver` es la funcionalidad entera y cada código
 * de dentro responde solo por su parte. Que el servidor entregue los datos con ese mismo
 * código lo fija `PermisoUnicoPorPantallaTests` en el repositorio del backend.
 */
function preparar(permisos: readonly string[]) {
  window.__FINANZAS_CONFIG__ = { mode: 'demo' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
    ],
  });
  const store = TestBed.inject(DemoStore);
  store.user.set({ ...store.users[0], capabilities: [...permisos] });
  return store;
}

describe('«ver» es la funcionalidad entera', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('no queda ningún «listar» de pantalla que haya que marcar aparte', () => {
    // La regresión, dicha sobre el catálogo: un `X.listar` junto a un `X.ver` vuelve a
    // partir en dos la misma concesión, y volver a partirla es volver al fallo.
    const codigos = new Set<string>();
    const recorrer = (nodo: unknown): void => {
      if (typeof nodo === 'string') codigos.add(nodo);
      else Object.values(nodo as Record<string, unknown>).forEach(recorrer);
    };
    recorrer(P);

    const partidos = [...codigos]
      .filter((codigo) => codigo.endsWith('.listar'))
      .filter((codigo) => codigos.has(`${codigo.slice(0, -'.listar'.length)}.ver`))
      .sort();

    expect(partidos, `estos permisos siguen partidos en dos: ${partidos.join(', ')}`).toEqual([]);
  });

  it('cada entrada del menú lateral aparece con su permiso y solo con él', () => {
    // El caso literal que se reportó: quitar todos los permisos y dejar uno.
    for (const entrada of navigation) {
      preparar([entrada.capability]);
      const caps = TestBed.inject(CAPABILITIES);
      const visibles = navigation.filter((x) => caps.allows(x.capability)).map((x) => x.path);

      expect(visibles, `«${entrada.label}» no sale en el menú con ${entrada.capability}`).toEqual([entrada.path]);
    }
  });

  it('con «ver dashboard» y un solo KPI se ve ese KPI y no una explicación', () => {
    preparar([P.dashboard.ver, P.dashboard.kpi.gastos]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.sin-acceso')).toBeNull();
    expect(raiz.textContent ?? '').toContain('Gastos');
  });

  it('con «ver dashboard» y solo la tabla se ve la tabla, sin ningún KPI', () => {
    preparar([P.dashboard.ver, P.dashboard.tabla.ver]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.sin-acceso')).toBeNull();
    expect(raiz.querySelector('table')).not.toBeNull();
    expect(fixture.componentInstance.algunKpi()).toBe(false);
  });

  it('sin ninguna pieza del panel se explica, en vez de dejarlo en blanco', () => {
    // El único caso en que la explicación es la respuesta correcta.
    preparar([P.dashboard.ver]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sin-acceso')).not.toBeNull();
  });
});
