import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, type ApiAdminFeatureFlag, type ApiAdminOrganizationFlag } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { AdminDrafts } from './admin-drafts';
import { AdminFlagsStore } from './admin-flags.store';

const global = (key: string, isEnabled: boolean): ApiAdminFeatureFlag => ({
  key,
  organizationId: null,
  userId: null,
  isEnabled,
  updatedAt: '2026-11-01T00:00:00Z',
});

const deOrganizacion = (key: string, organizationId: string, isEnabled: boolean): ApiAdminFeatureFlag => ({
  ...global(key, isEnabled),
  organizationId,
});

const efectiva = (
  key: string,
  organizationValue: boolean | null,
  globalEnabled: boolean,
  source: ApiAdminOrganizationFlag['source'] = 'organization',
): ApiAdminOrganizationFlag => ({
  key,
  isEnabled: (organizationValue ?? true) && globalEnabled,
  source,
  organizationValue,
  globalEnabled,
});

function montar(api: Record<string, unknown> = {}, permisos: string[] = [P.administracion.banderas.listar]) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AdminFlagsStore,
      AdminDrafts,
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: AdministrationApi, useValue: api },
    ],
  });
  TestBed.inject(AppStore).user.set({ ...USUARIO_DE_PRUEBA, capabilities: permisos });
  return { banderas: TestBed.inject(AdminFlagsStore), app: TestBed.inject(AppStore) };
}

describe('banderas de la organización', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('la lista de plataforma solo trae las globales, sin repetir y ordenadas', () => {
    const { banderas } = montar();
    banderas.flags.set([
      global('movimientos', true),
      deOrganizacion('movimientos', 'org1', false),
      global('calendario', true),
      { ...global('reportes', true), userId: 'u1' },
      global('calendario', false),
    ]);

    expect(banderas.platformFlags().map((flag) => flag.key)).toEqual(['calendario', 'movimientos']);
  });

  it('una bandera global toma su valor guardado, y apagada por defecto si no existe', () => {
    const { banderas } = montar();
    banderas.flags.set([global('movimientos', true)]);

    expect(banderas.flagValue('movimientos', null, null)).toBe(true);
    expect(banderas.flagValue('desconocida', null, null)).toBe(false);
  });

  it('cambiarla crea un borrador, y volver al valor guardado lo quita', () => {
    const { banderas } = montar();
    banderas.flags.set([global('movimientos', true)]);

    banderas.setFlag('movimientos', null, null, false);
    expect(banderas.flagChanged('movimientos', null, null)).toBe(true);
    expect(banderas.flagValue('movimientos', null, null)).toBe(false);

    banderas.setFlag('movimientos', null, null, true);
    expect(banderas.flagChanged('movimientos', null, null)).toBe(false);
  });

  it('una organización no puede tener encendida lo que la plataforma apagó', () => {
    const { banderas } = montar();
    banderas.flags.set([global('movimientos', false), deOrganizacion('movimientos', 'org1', true)]);

    expect(banderas.globalFlagValue('movimientos')).toBe(false);
    expect(banderas.flagValue('movimientos', 'org1', null)).toBe(false);
  });

  it('con la bandera global encendida, la organización usa su propio valor', () => {
    const { banderas } = montar();
    banderas.flags.set([global('movimientos', true), deOrganizacion('movimientos', 'org1', false)]);

    expect(banderas.flagValue('movimientos', 'org1', null)).toBe(false);
    expect(banderas.flagValue('movimientos', 'org2', null)).toBe(true);
  });

  it('apagar la global en un borrador bloquea de inmediato a las organizaciones', () => {
    const { banderas } = montar();
    banderas.flags.set([global('movimientos', true), deOrganizacion('movimientos', 'org1', true)]);

    banderas.setFlag('movimientos', null, null, false);

    expect(banderas.flagValue('movimientos', 'org1', null)).toBe(false);
  });

  it('los valores efectivos cargados de la organización mandan sobre las banderas sueltas', async () => {
    const api = { adminOrganizationFlags: vi.fn(() => of([efectiva('movimientos', false, true)])) };
    const { banderas } = montar(api);
    banderas.flags.set([global('movimientos', true)]);

    await banderas.cargarBanderasDe('org1');

    expect(api.adminOrganizationFlags).toHaveBeenCalledWith('org1');
    expect(banderas.flagValue('movimientos', 'org1', null)).toBe(false);
  });

  it('sin permiso de listar banderas no pide nada', async () => {
    const api = { adminOrganizationFlags: vi.fn(() => of([])) };
    const { banderas } = montar(api, []);

    await banderas.cargarBanderasDe('org1');

    expect(api.adminOrganizationFlags).not.toHaveBeenCalled();
  });

  it('si la carga falla avisa en lugar de callar', async () => {
    const api = { adminOrganizationFlags: vi.fn(() => throwError(() => new Error('sin red'))) };
    const { banderas, app } = montar(api);

    await banderas.cargarBanderasDe('org1');

    expect(app.toast.texto()).not.toBe('');
  });

  it('guardar una global envía la bandera sin organización y reemplaza la anterior', async () => {
    const api = {
      updateAdminFeatureFlag: vi.fn(() => of(global('movimientos', false))),
      adminOrganizationFlags: vi.fn(() => of([])),
    };
    const { banderas } = montar(api);
    banderas.flags.set([global('movimientos', true)]);

    await banderas.guardar({ kind: 'flag', key: 'movimientos', organizationId: null, userId: null, value: false });

    expect(api.updateAdminFeatureFlag).toHaveBeenCalledWith('movimientos', {
      organizationId: null,
      userId: null,
      isEnabled: false,
    });
    expect(banderas.flags().filter((flag) => flag.key === 'movimientos')).toHaveLength(1);
    expect(banderas.globalFlagValue('movimientos')).toBe(false);
  });

  it('guardar la de una organización deja su valor efectivo respetando la global', async () => {
    const api = {
      updateAdminFeatureFlag: vi.fn(() => of(deOrganizacion('movimientos', 'org1', true))),
      adminOrganizationFlags: vi.fn(() => of([efectiva('movimientos', null, false, 'global')])),
    };
    const { banderas } = montar(api);
    await banderas.cargarBanderasDe('org1');

    await banderas.guardar({ kind: 'flag', key: 'movimientos', organizationId: 'org1', userId: null, value: true });

    const propia = banderas.organizationFlagsOf('org1')!.find((flag) => flag.key === 'movimientos');
    expect(propia).toMatchObject({
      source: 'organization',
      organizationValue: true,
      globalEnabled: false,
      isEnabled: false,
    });
  });
});
