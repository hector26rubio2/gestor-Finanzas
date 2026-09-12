import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '../../core/api-client';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { HeaderActionsService } from '../../shared/header-actions.service';

@Component({
  selector: 'app-notifications-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-tab.html',
  styleUrl: './notifications-tab.css',
})
export class NotificationsTabComponent implements OnInit, OnDestroy {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  private api = inject(FinanceApiClient);
  private readonly headerActions = inject(HeaderActionsService);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  /** El boton de la cabecera compartida delega aqui mientras esta pestaña esta activa. */
  ngOnInit(): void {
    this.headerActions.readAll.set(() => void this.readAll());
  }
  ngOnDestroy(): void {
    this.headerActions.readAll.set(null);
  }

  async readAll(): Promise<void> {
    if (this.store.runtime.mode === 'api') {
      try {
        const unread = this.store.data().notifications.filter((item) => !item.read);
        await Promise.all(unread.map((item) => firstValueFrom(this.api.markNotificationRead(item.id))));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudieron actualizar las notificaciones.');
        return;
      }
    }
    this.store.data.update((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
  }
  async mark(id: string): Promise<void> {
    if (this.store.runtime.mode === 'api') {
      try {
        await firstValueFrom(this.api.markNotificationRead(id));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudo actualizar la notificación.');
        return;
      }
    }
    this.store.data.update((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }
  reviewNotification(id: string): void {
    const pending = this.store.data().movements.find((movement) => movement.status === 'pending');
    this.store.open('expense', pending?.accountId ?? 'credit-indigo', pending, id);
  }
}
