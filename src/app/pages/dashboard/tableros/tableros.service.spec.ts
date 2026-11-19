import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { type ApiSavedDashboard, DashboardsApi } from '@core/api/dashboards.api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { DashboardLayoutService, DISENO_VACIO_JSON } from '@shared/tablero/dashboard-layout.service';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { TABLERO_PRINCIPAL, TablerosService } from './tableros.service';

const tablero = (id: string, parcial: Partial<ApiSavedDashboard> = {}): ApiSavedDashboard => ({
  id,
  name: `Tablero ${id}`,
  owner: { id: 'yo', name: 'Yo' } as never,
  isMine: true,
  isPinned: false,
  sharedWith: [],
  layoutJson: '{"version":2}',
  updatedAt: '2026-08-01T00:00:00Z',
  ...parcial,
});

const PERMISOS = [
  P.dashboard.ver,
  P.dashboard.tableros.crear,
  P.dashboard.tableros.accesos.editar,
  P.dashboard.compartidos.ver,
];

function montar(tableros: ApiSavedDashboard[], permisos: readonly string[] = PERMISOS) {
  const api = {
    dashboards: vi.fn(() => of(tableros)),
    dashboard: vi.fn((id: string) => of(tableros.find((t) => t.id === id) ?? tablero(id))),
    create: vi.fn((cuerpo: { name: string }) => of(tablero('nuevo', { name: cuerpo.name }))),
    update: vi.fn(() => of({})),
    remove: vi.fn(() => of({})),
    members: vi.fn(() => of([{ id: 'u1', name: 'Ana' }])),
    share: vi.fn(() => of({})),
  };
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      { provide: DashboardsApi, useValue: api },
      {
        provide: FinanceApiClient,
        useValue: { session: vi.fn(() => of(null)), saveDashboardLayout: vi.fn(() => of({})) },
      },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [...permisos] });
  store.remoteState.set('ready');
  const servicio = TestBed.inject(TablerosService);
  const layout = TestBed.inject(DashboardLayoutService);
  TestBed.tick();
  return { api, servicio, layout };
}

describe('Dashboard: tableros propios, compartidos y duplicados', () => {
  beforeEach(() => localStorage.clear());

  it('separa mis tableros de los que otros comparten conmigo', async () => {
    const { servicio } = montar([tablero('a'), tablero('b', { isMine: false })]);
    await servicio.recargar();

    expect(servicio.propios().map((t) => t.id)).toEqual(['a']);
    expect(servicio.compartidos().map((t) => t.id)).toEqual(['b']);
  });

  it('sin el permiso de ver compartidos no se listan', async () => {
    const { servicio } = montar([tablero('b', { isMine: false })], [P.dashboard.ver]);
    await servicio.recargar();

    expect(servicio.compartidos()).toEqual([]);
  });

  it('abrir un tablero compartido lo deja en solo lectura', async () => {
    const { servicio, layout } = montar([tablero('b', { isMine: false })]);
    await servicio.recargar();

    await servicio.abrir('b');

    expect(servicio.activo()).toBe('b');
    expect(layout.soloLectura()).toBe(true);
  });

  it('abrir uno propio permite editar y volver al principal también', async () => {
    const { servicio, layout } = montar([tablero('a')]);
    await servicio.recargar();

    await servicio.abrir('a');
    expect(layout.soloLectura()).toBe(false);
    expect(layout.esPrincipal()).toBe(false);

    await servicio.abrir(TABLERO_PRINCIPAL);
    expect(layout.esPrincipal()).toBe(true);
  });

  it('duplicar el tablero principal envía el diseño actual como copia', async () => {
    const { servicio, api, layout } = montar([]);
    layout.moveWidget('a', 1);

    await servicio.crear('Copia', true);

    const cuerpo = api.create.mock.calls[0][0] as { name: string; layoutJson: string | null; copyFrom: string | null };
    expect(cuerpo).toMatchObject({ name: 'Copia', copyFrom: null });
    expect(servicio.activo()).toBe('nuevo');
  });

  it('duplicar un tablero propio pide al servidor copiarlo por su id', async () => {
    const { servicio, api } = montar([tablero('a')]);
    await servicio.recargar();
    await servicio.abrir('a');

    await servicio.crear('Copia de A', true);

    expect(api.create).toHaveBeenCalledWith({ name: 'Copia de A', layoutJson: null, copyFrom: 'a' });
  });

  it('crear uno nuevo sin copiar parte de un diseño vacío', async () => {
    const { servicio, api } = montar([tablero('a')]);
    await servicio.recargar();
    await servicio.abrir('a');

    await servicio.crear('Vacío', false);

    expect(api.create).toHaveBeenCalledWith({ name: 'Vacío', layoutJson: DISENO_VACIO_JSON, copyFrom: null });
  });

  it('compartir envía los usuarios elegidos del tablero propio y recarga la lista', async () => {
    const { servicio, api } = montar([tablero('a')]);
    await servicio.recargar();
    await servicio.abrir('a');

    await servicio.compartir(['u1', 'u2']);

    expect(api.share).toHaveBeenCalledWith('a', ['u1', 'u2']);
    expect(api.dashboards.mock.calls.length).toBeGreaterThan(1);
  });

  it('no se puede compartir, renombrar ni borrar un tablero que no es mío', async () => {
    const { servicio, api } = montar([tablero('b', { isMine: false })]);
    await servicio.recargar();
    await servicio.abrir('b');

    await servicio.compartir(['u1']);
    await servicio.renombrar('Otro nombre');
    await servicio.borrar();

    expect(api.share).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('con el permiso de accesos se cargan las personas con quien compartir, y sin él no', async () => {
    const con = montar([tablero('a')]);
    await con.servicio.cargarMiembros();
    expect(con.servicio.miembros().map((m) => m.name)).toEqual(['Ana']);

    const sin = montar([tablero('a')], [P.dashboard.ver, P.dashboard.tableros.crear]);
    await sin.servicio.cargarMiembros();
    expect(sin.api.members).not.toHaveBeenCalled();
    expect(sin.servicio.miembros()).toEqual([]);
  });

  it('renombrar y fijar guardan en el servidor con el nombre nuevo', async () => {
    const { servicio, api } = montar([tablero('a')]);
    await servicio.recargar();
    await servicio.abrir('a');

    await servicio.renombrar('  Mi tablero  ');
    await servicio.alternarFijado();

    expect(api.update).toHaveBeenNthCalledWith(1, 'a', expect.objectContaining({ name: 'Mi tablero' }));
    expect(api.update).toHaveBeenNthCalledWith(2, 'a', expect.objectContaining({ isPinned: true }));
  });

  it('borrar uno propio lo quita del servidor y vuelve al principal', async () => {
    const { servicio, api } = montar([tablero('a')]);
    await servicio.recargar();
    await servicio.abrir('a');

    await servicio.borrar();

    expect(api.remove).toHaveBeenCalledWith('a');
    expect(servicio.activo()).toBe(TABLERO_PRINCIPAL);
  });

  it('sin permiso de crear no se puede crear', () => {
    const { servicio } = montar([], [P.dashboard.ver]);

    expect(servicio.puedeCrear()).toBe(false);
  });
});
