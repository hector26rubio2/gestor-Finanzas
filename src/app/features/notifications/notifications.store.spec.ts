import { ApplicationRef, DestroyRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiNotification, ApiWritesBus, NotificationsApi } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { NotificationsStore } from './notifications.store';

const aviso = (id: string, readAt: string | null = null): ApiNotification => ({
  id,
  kind: 'permissions.updated',
  title: id,
  payloadJson: '{}',
  readAt,
  createdAt: '2026-10-01T00:00:00Z',
});

const estabilizar = async () => {
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
};

describe('NotificationsStore', () => {
  function montar(notifications: ReturnType<typeof vi.fn>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsApi, useValue: { notifications } },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    const app = TestBed.inject(AppStore);
    app.user.set({ id: 'u1', name: 'Ana', email: 'ana@example.test', capabilities: [] });
    app.organization.set({ id: 'o1', name: 'Personal' });
    app.remoteState.set('ready');
    app.avisosRecientes.set([aviso('reciente')]);
    app.sinLeerDelArranque.set(3);
    return { app, store: TestBed.inject(NotificationsStore) };
  }

  const solicitar = (store: NotificationsStore) => store.solicitar(TestBed.inject(Injector).get(DestroyRef));

  beforeEach(() => TestBed.resetTestingModule());

  it('muestra los avisos recientes del arranque sin pedir nada hasta solicitarlo', async () => {
    const notifications = vi.fn(() => of([]));
    const { app, store } = montar(notifications);
    await estabilizar();

    expect(notifications).not.toHaveBeenCalled();
    expect(store.estado()).toBe('inactivo');
    expect(store.items().map((n) => n.id)).toEqual(['reciente']);
    expect(app.unread()).toBe(3);
  });

  it('carga la lista completa una vez y fija el contador de no leídos', async () => {
    const notifications = vi.fn(() => of([aviso('a'), aviso('b'), aviso('c', '2026-10-02T00:00:00Z')]));
    const { app, store } = montar(notifications);

    solicitar(store);
    await estabilizar();

    expect(notifications).toHaveBeenCalledTimes(1);
    expect(store.estado()).toBe('listo');
    expect(store.items().map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(app.unread()).toBe(2);
  });

  it('marca el error y conserva los avisos recientes', async () => {
    const notifications = vi.fn(() => throwError(() => new Error('sin red')));
    const { app, store } = montar(notifications);

    solicitar(store);
    await estabilizar();

    expect(store.estado()).toBe('error');
    expect(store.items().map((n) => n.id)).toEqual(['reciente']);
    expect(app.unread()).toBe(3);
  });

  it('marcar leídas actualiza la lista y el contador al instante', async () => {
    const notifications = vi.fn(() => of([aviso('a'), aviso('b')]));
    const { app, store } = montar(notifications);
    solicitar(store);
    await estabilizar();

    store.marcarLeidas(new Set(['a']));
    await estabilizar();

    expect(store.items().find((n) => n.id === 'a')?.read).toBe(true);
    expect(app.unread()).toBe(1);
  });

  it('recarga tras una escritura mientras se usa', async () => {
    const notifications = vi.fn(() => of([aviso('a')]));
    const { store } = montar(notifications);
    solicitar(store);
    await estabilizar();

    TestBed.inject(ApiWritesBus).notify();
    await estabilizar();

    expect(notifications).toHaveBeenCalledTimes(2);
  });

  it('vuelve a pedir si cambia el contador del servidor', async () => {
    const notifications = vi.fn(() => of([aviso('a')]));
    const { app, store } = montar(notifications);
    solicitar(store);
    await estabilizar();

    app.sinLeerDelArranque.set(4);
    await estabilizar();

    expect(notifications).toHaveBeenCalledTimes(2);
  });
});
