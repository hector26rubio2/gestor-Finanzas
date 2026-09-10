import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from './api-client';
import { P } from './permissions';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { CAPABILITIES, DemoStore, FEATURES, navigation } from './store';

describe('permisos granulares', () => {
  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
  });

  it('cada entrada de navegación pide el permiso «ver» de su recurso', () => {
    const esperado: Record<string, string> = {
      dashboard: P.dashboard.ver,
      movements: P.movimientos.ver,
      calendar: P.calendario.ver,
      accounts: P.cuentas.ver,
      people: P.personas.ver,
      portfolio: P.patrimonio.ver,
      planning: P.planificacion.ver,
      reports: P.reportes.ver,
      notifications: P.notificaciones.ver,
      admin: P.administracion.ver,
      settings: P.preferencias.ver,
    };

    expect(navigation).toHaveLength(11);
    for (const entrada of navigation) {
      expect(entrada.capability).toBe(esperado[entrada.path]);
      expect(entrada.capability.endsWith('.ver')).toBe(true);
    }
  });

  it('los códigos respetan la convención recurso.subrecurso.accion', () => {
    const acciones = ['ver', 'listar', 'crear', 'editar', 'eliminar', 'deshabilitar', 'exportar'];
    const recorrer = (nodo: unknown): string[] =>
      typeof nodo === 'string' ? [nodo] : Object.values(nodo as Record<string, unknown>).flatMap(recorrer);

    const codigos = recorrer(P);
    expect(codigos.length).toBeGreaterThan(60);
    for (const codigo of codigos) {
      expect(codigo).toBe(codigo.toLowerCase());
      expect(codigo).not.toMatch(/[áéíóúñ]/);
      const partes = codigo.split('.');
      expect(partes.length).toBeGreaterThanOrEqual(2);
      expect(acciones).toContain(partes[partes.length - 1]);
    }
  });

  it('no hay dos códigos repetidos', () => {
    const recorrer = (nodo: unknown): string[] =>
      typeof nodo === 'string' ? [nodo] : Object.values(nodo as Record<string, unknown>).flatMap(recorrer);
    const codigos = recorrer(P);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('allows compara contra los permisos que trae la sesión', () => {
    const store = TestBed.inject(DemoStore);
    const caps = TestBed.inject(CAPABILITIES);
    store.user.set({ ...store.users[0], capabilities: [P.movimientos.ver] });

    expect(caps.allows(P.movimientos.ver)).toBe(true);
    // Ver la vista ya no concede escribir en ella: es el punto de toda la matriz.
    expect(caps.allows(P.movimientos.crear)).toBe(false);
    expect(caps.allows(P.cuentas.ver)).toBe(false);
  });
});

describe('banderas de funcionalidad', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('en modo demo una clave ausente habilita', () => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    const features = TestBed.inject(FEATURES);
    expect(features.enabled('cualquier-cosa')).toBe(true);
  });

  it('contra la API, mientras el catálogo no llegue, nada abre', () => {
    window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: 'https://api.example.test' };
    const store = TestBed.inject(DemoStore);
    const features = TestBed.inject(FEATURES);

    // Antes devolvía true: un fallo de red abría todo en vez de cerrarlo.
    expect(store.featureFlagsLoaded()).toBe(false);
    expect(features.enabled('movements')).toBe(false);

    store.featureFlagsLoaded.set(true);
    expect(features.enabled('movements')).toBe(true);
    store.featureFlags.set({ movements: false });
    expect(features.enabled('movements')).toBe(false);
  });
});

describe('sesión sin permisos', () => {
  const sesionSinPermisos = {
    user: { id: 'u1', displayName: 'Sin permisos', email: 'sin@example.test', isActive: true },
    organization: { id: 'o1', name: 'Personal', slug: 'personal', baseCurrency: 'COP', isActive: true, createdAt: '' },
    capabilities: [],
    organizations: [],
    expiresAt: '',
    permissions: [] as string[],
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('lo dice en vez de dejar la aplicación vacía en silencio', async () => {
    const api = { session: vi.fn(() => of(sesionSinPermisos)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    const store = TestBed.inject(DemoStore);
    expect(store.remoteState()).toBe('error');
    expect(store.remoteError()).toContain('permisos');
    expect(store.user()).toBeNull();
  });

  it('un 401 sigue tratándose como visitante anónimo, no como error', async () => {
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
    expect(TestBed.inject(DemoStore).remoteState()).toBe('anonymous');
  });
});
