import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiAuditEvent } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminAuditStore } from '@pages/admin/stores/admin-audit.store';
import { AuditTabComponent } from './audit-tab';

const evento = (cambios: Partial<ApiAuditEvent> = {}): ApiAuditEvent =>
  ({
    id: 'e1',
    createdAt: '2026-11-18T10:00:00Z',
    action: 'movement.created',
    entityType: 'Movement',
    entityId: 'mov-1',
    actorUserId: 'u1',
    userId: null,
    traceId: 'abcdef1234567890',
    changesJson: '{"monto":100}',
    ...cambios,
  }) as ApiAuditEvent;

function montar(eventos: ApiAuditEvent[] = [evento()]) {
  const cargar = vi.fn<(pagina: number, filtro: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
  const filtro = signal<Record<string, string | undefined>>({});
  const auditoria = {
    filter: filtro,
    events: signal(eventos),
    total: signal(eventos.length),
    page: signal(1),
    size: signal(25),
    cargando: signal(false),
    erroresDeLaAccion: signal([]),
    cargar,
  };
  const admin = {
    loading: signal(false),
    users: signal([
      { id: 'u1', displayName: 'Ana', email: 'ana@t.dev' },
      { id: 'u2', displayName: 'Beto', email: 'beto@t.dev' },
    ]),
    organizations: signal([{ id: 'org1', name: 'Personal' }]),
    userName: (id: string) => (id === 'u1' ? 'Ana' : id === 'u2' ? 'Beto' : id),
  };
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: AdminAuditStore, useValue: auditoria },
      { provide: AdminStore, useValue: admin },
    ],
  });
  const componente = TestBed.runInInjectionContext(() => new AuditTabComponent());
  return { componente, cargar };
}

const ultimoFiltro = (cargar: { mock: { calls: unknown[][] } }) =>
  cargar.mock.calls.at(-1)![1] as Record<string, unknown>;

describe('Auditoría: filtros', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('filtrar por acción vuelve a la primera página con esa acción', () => {
    const { componente, cargar } = montar();

    componente.update('action', 'movement.created');

    expect(cargar.mock.calls.at(-1)![0]).toBe(1);
    expect(ultimoFiltro(cargar)).toMatchObject({ action: 'movement.created' });
  });

  it('los filtros se combinan: acción, entidad, quien lo hizo y a quién afectó', () => {
    const { componente, cargar } = montar();

    componente.update('action', 'user.roles');
    componente.update('entityType', 'user');
    componente.update('actor', 'u1');
    componente.update('affected', 'u2');

    expect(ultimoFiltro(cargar)).toMatchObject({
      action: 'user.roles',
      entityType: 'user',
      actorUserId: 'u1',
      userId: 'u2',
    });
  });

  it('las fechas se envían como el primer y el último instante de cada día', () => {
    const { componente, cargar } = montar();

    componente.update('from', '2026-11-01');
    componente.update('to', '2026-11-18');

    const filtro = ultimoFiltro(cargar) as { from: string; to: string };
    expect(new Date(filtro.from).getDate()).toBe(1);
    expect(new Date(filtro.to).getDate()).toBe(18);
    expect(new Date(filtro.to).getHours()).toBe(23);
  });

  it('un filtro vacío no se envía', () => {
    const { componente, cargar } = montar();
    componente.update('action', 'movement.created');

    componente.update('action', '');

    expect(ultimoFiltro(cargar)['action']).toBeUndefined();
  });

  it('hay filtros activos solo cuando alguno tiene valor, y limpiar los quita todos', () => {
    const { componente, cargar } = montar();
    expect(componente.hasFilters()).toBe(false);

    componente.update('actor', 'u1');
    componente.update('from', '2026-11-01');
    expect(componente.hasFilters()).toBe(true);

    componente.clear();

    expect(componente.hasFilters()).toBe(false);
    expect(cargar.mock.calls.at(-1)).toEqual([1, {}]);
  });

  it('filtrar por traza conserva los demás filtros y quitarla los deja', () => {
    const { componente, cargar } = montar();
    componente.update('action', 'movement.created');

    componente.filterByTrace('abc123');
    expect(ultimoFiltro(cargar)).toMatchObject({ action: 'movement.created', traceId: 'abc123' });

    componente.filterByTrace('');
    expect(ultimoFiltro(cargar)['traceId']).toBeUndefined();
    expect(ultimoFiltro(cargar)).toMatchObject({ action: 'movement.created' });
  });
});

describe('Auditoría: lo que se muestra de cada evento', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un evento sin actor se atribuye al sistema', () => {
    const { componente } = montar();

    expect(componente.actorName(evento({ actorUserId: null }))).toBe(componente.i18n.t('admin.audit.systemActor'));
    expect(componente.actorName(evento({ actorUserId: 'u1' }))).toBe('Ana');
  });

  it('la entidad afectada se muestra con el nombre de la persona o de la organización', () => {
    const { componente } = montar();

    expect(componente.entityDetail(evento({ entityType: 'user', entityId: 'u2' }))).toBe('Beto');
    expect(componente.entityDetail(evento({ entityType: 'organization', entityId: 'org1' }))).toBe('Personal');
    expect(componente.entityDetail(evento({ entityType: 'organization', entityId: 'desconocida' }))).toBe(
      'desconocida',
    );
    expect(componente.entityDetail(evento({ entityType: 'Movement', entityId: 'mov-9' }))).toBe('mov-9');
    expect(componente.entityDetail(evento({ entityId: null }))).toBe('—');
  });

  it('las filas llevan la acción con su nombre legible y el evento original', () => {
    const { componente } = montar();

    const [fila] = componente.rows();
    expect(fila.action).toBe(componente.labels.auditAction('movement.created'));
    expect(fila.action).not.toBe('movement.created');
    expect(fila.raw.id).toBe('e1');
    expect(fila.affected).toBe('—');
  });

  it('los cambios se muestran sangrados y sin cambios quedan vacíos', () => {
    const { componente } = montar();

    expect(componente.changes(evento({ changesJson: '{"monto":100}' }))).toBe('{\n  "monto": 100\n}');
    expect(componente.changes(evento({ changesJson: null }))).toBe('');
  });
});
