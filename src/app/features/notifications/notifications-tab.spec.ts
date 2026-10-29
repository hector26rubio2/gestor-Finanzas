import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import type { AppNotification } from '@core/state/view-model';
import { HeaderActionsService } from '@shared/header-actions.service';
import { NotificationsStore } from './notifications.store';
import { NotificationsTabComponent } from './notifications-tab';

const aviso = (id: string): AppNotification =>
  ({ id, kind: 'permissions.updated', title: id, read: false, createdAt: '2026-10-01T00:00:00Z' }) as AppNotification;

function montar(permitido: boolean, markNotificationRead: ReturnType<typeof vi.fn>) {
  const marcarLeidas = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      { provide: FinanceApiClient, useValue: { markNotificationRead } },
      { provide: CAPABILITIES, useValue: { allows: () => permitido } },
      {
        provide: NotificationsStore,
        useValue: { items: signal([aviso('a'), aviso('b'), aviso('c')]), solicitar: vi.fn(), marcarLeidas },
      },
    ],
  });
  const componente = TestBed.runInInjectionContext(() => new NotificationsTabComponent());
  return {
    componente,
    marcarLeidas,
    store: TestBed.inject(AppStore),
    cabecera: TestBed.inject(HeaderActionsService),
  };
}

describe('NotificationsTabComponent: marcar todas', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin permiso no llama al api y no registra la accion de cabecera', async () => {
    const markNotificationRead = vi.fn(() => of(undefined));
    const { componente, cabecera, marcarLeidas } = montar(false, markNotificationRead);
    componente.ngOnInit();

    expect(cabecera.readAll()).toBeNull();
    await componente.readAll();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(marcarLeidas).not.toHaveBeenCalled();
  });

  it('con permiso registra la accion de cabecera', () => {
    const { componente, cabecera } = montar(
      true,
      vi.fn(() => of(undefined)),
    );
    componente.ngOnInit();
    expect(cabecera.readAll()).not.toBeNull();
  });

  it('si una falla marca solo las exitosas y avisa', async () => {
    const markNotificationRead = vi.fn((id: string) => (id === 'b' ? throwError(() => new Error('x')) : of(undefined)));
    const { componente, marcarLeidas, store } = montar(true, markNotificationRead);
    await componente.readAll();

    expect(marcarLeidas).toHaveBeenCalledTimes(1);
    expect([...marcarLeidas.mock.calls[0][0]].sort()).toEqual(['a', 'c']);
    expect(store.toast.texto()).toBe(componente.i18n.t('notifications.updateError'));
  });

  it('si todas salen bien marca todas sin aviso', async () => {
    const { componente, marcarLeidas, store } = montar(
      true,
      vi.fn(() => of(undefined)),
    );
    await componente.readAll();

    expect([...marcarLeidas.mock.calls[0][0]].sort()).toEqual(['a', 'b', 'c']);
    expect(store.toast.texto()).toBe('');
  });
});
