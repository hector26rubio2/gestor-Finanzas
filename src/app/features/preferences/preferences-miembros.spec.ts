import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { PreferencesTabComponent } from './preferences-tab';

const miembro = (cambios: Record<string, unknown> = {}) => ({
  membershipId: 'm1',
  userId: 'u1',
  displayName: 'Ana',
  email: 'ana@test.dev',
  status: 'Active',
  roles: ['Propietario'],
  createdAt: '2026-01-01T00:00:00Z',
  ...cambios,
});

const ROLES = {
  items: [
    { id: 'rol-beta', name: 'Beta' },
    { id: 'rol-colab', name: 'Colaborador' },
  ],
};

function montar(opciones: { capacidades?: string[]; invitar?: ReturnType<typeof vi.fn> } = {}) {
  const api = {
    organizationMembers: vi.fn(() => of([miembro()])),
    adminRoles: vi.fn(() => of(ROLES)),
    inviteOrganizationMember:
      opciones.invitar ??
      vi.fn(() =>
        of(
          miembro({
            membershipId: 'm2',
            displayName: 'Beto',
            email: 'beto@test.dev',
            status: 'Invited',
            roles: ['Beta'],
          }),
        ),
      ),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: api },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({
    ...USUARIO_DE_PRUEBA,
    capabilities: opciones.capacidades ?? [P.organizacion.miembros.listar, P.administracion.roles.listar],
  });
  const componente = TestBed.runInInjectionContext(() => new PreferencesTabComponent());
  return { componente, api, store };
}

const evento = () => ({ preventDefault: vi.fn() }) as unknown as Event;

describe('Preferencias: miembros e invitar', () => {
  beforeEach(() => localStorage.clear());

  it('carga los miembros y los roles, y propone el primer rol para invitar', async () => {
    const { componente } = montar();

    componente.ngOnInit();
    await vi.waitFor(() => expect(componente.miembros()).toHaveLength(1));

    expect(componente.rolesDisponibles().map((rol) => rol.name)).toEqual(['Beta', 'Colaborador']);
    expect(componente.rolInvitado).toBe('rol-beta');
  });

  it('sin permiso de listar miembros no pide nada', async () => {
    const { componente, api } = montar({ capacidades: [] });

    componente.ngOnInit();
    await Promise.resolve();

    expect(api.organizationMembers).not.toHaveBeenCalled();
    expect(componente.miembros()).toEqual([]);
  });

  it('invitar envía el correo recortado y el rol, y lo lista como pendiente', async () => {
    const { componente, api, store } = montar();
    componente.ngOnInit();
    await vi.waitFor(() => expect(componente.miembros()).toHaveLength(1));
    componente.correoInvitado = '  beto@test.dev ';
    componente.nombreInvitado = 'Beto';

    await componente.invitar(evento());

    expect(api.inviteOrganizationMember).toHaveBeenCalledWith({
      email: 'beto@test.dev',
      displayName: 'Beto',
      roleIds: ['rol-beta'],
    });
    const invitado = componente.miembros().find((m) => m.membershipId === 'm2');
    expect(invitado?.status).toBe('Invited');
    expect(store.toast.texto()).toContain('beto@test.dev');
  });

  it('al invitar se limpian el correo y el nombre', async () => {
    const { componente } = montar();
    componente.ngOnInit();
    await vi.waitFor(() => expect(componente.rolInvitado).toBe('rol-beta'));
    componente.correoInvitado = 'beto@test.dev';
    componente.nombreInvitado = 'Beto';

    await componente.invitar(evento());

    expect(componente.correoInvitado).toBe('');
    expect(componente.nombreInvitado).toBe('');
  });

  it('un nombre en blanco no se envía', async () => {
    const { componente, api } = montar();
    componente.ngOnInit();
    await vi.waitFor(() => expect(componente.rolInvitado).toBe('rol-beta'));
    componente.correoInvitado = 'beto@test.dev';
    componente.nombreInvitado = '   ';

    await componente.invitar(evento());

    expect((api.inviteOrganizationMember.mock.calls[0][0] as { displayName?: string }).displayName).toBeUndefined();
  });

  it('sin correo o sin rol no llama a la API', async () => {
    const { componente, api } = montar();

    componente.correoInvitado = '   ';
    componente.rolInvitado = 'rol-beta';
    await componente.invitar(evento());
    componente.correoInvitado = 'beto@test.dev';
    componente.rolInvitado = '';
    await componente.invitar(evento());

    expect(api.inviteOrganizationMember).not.toHaveBeenCalled();
  });

  it('si la API rechaza muestra el motivo y conserva lo escrito', async () => {
    const { componente } = montar({
      invitar: vi.fn(() => throwError(() => new Error('Ese correo ya es miembro.'))),
    });
    componente.ngOnInit();
    await vi.waitFor(() => expect(componente.rolInvitado).toBe('rol-beta'));
    componente.correoInvitado = 'ana@test.dev';

    await componente.invitar(evento());

    expect(componente.errorDeInvitacion()).toBe('Ese correo ya es miembro.');
    expect(componente.correoInvitado).toBe('ana@test.dev');
    expect(componente.miembros()).toHaveLength(1);
  });
});
