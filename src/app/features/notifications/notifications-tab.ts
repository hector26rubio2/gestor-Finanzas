import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { FinanceApiClient } from '@core/api';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import type { AppNotification } from '@core/state/view-model';
import { I18nService } from '@core/i18n';
import { HeaderActionsService } from '@shared/header-actions.service';
import { EmptyStateComponent } from '@ui/empty-state';
import { IconComponent, IconName } from '@ui/icon';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { agruparPorFecha, haceCuanto } from './notification-dates';

const ICONO_POR_TIPO: Readonly<Record<string, IconName>> = {
  'permissions.updated': 'shield',
  'organization.updated': 'organization',
};

type Filtro = 'all' | 'unread';

@Component({
  selector: 'app-notifications-tab',
  imports: [HlmButton, HlmToggleGroupImports, IconComponent, EmptyStateComponent],
  templateUrl: './notifications-tab.html',
})
export class NotificationsTabComponent implements OnInit, OnDestroy {
  readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  private api = inject(FinanceApiClient);
  private readonly headerActions = inject(HeaderActionsService);
  readonly i18n = inject(I18nService);
  readonly puedeMarcar = this.capabilities.allows(P.notificaciones.editar);
  readonly filtro = signal<Filtro>('all');
  readonly marcando = signal<ReadonlySet<string>>(new Set());

  private readonly todas = computed(() =>
    [...this.store.data().notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly sinLeer = computed(() => this.todas().filter((n) => !n.read).length);
  readonly opciones = computed<readonly { value: Filtro; label: string; total: number }[]>(() => [
    { value: 'all', label: this.i18n.t('notifications.filter.all'), total: this.todas().length },
    { value: 'unread', label: this.i18n.t('notifications.filter.unread'), total: this.sinLeer() },
  ]);
  readonly grupos = computed(() => {
    const visibles = this.filtro() === 'unread' ? this.todas().filter((n) => !n.read) : this.todas();
    return agruparPorFecha(visibles, new Date()).map((grupo) => ({
      ...grupo,
      titulo: this.i18n.t(`notifications.group.${grupo.clave}`),
    }));
  });

  ngOnInit(): void {
    this.headerActions.readAll.set(() => void this.readAll());
  }
  ngOnDestroy(): void {
    this.headerActions.readAll.set(null);
  }

  cambiarFiltro(valor: string): void {
    this.filtro.set(valor === 'unread' ? 'unread' : 'all');
  }

  icono(notificacion: AppNotification): IconName {
    return ICONO_POR_TIPO[notificacion.kind] ?? 'notifications';
  }

  cuando(notificacion: AppNotification): string {
    return haceCuanto(notificacion.createdAt, new Date(), this.store.preferences().locale);
  }

  fechaCompleta(notificacion: AppNotification): string {
    return new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(notificacion.createdAt),
    );
  }

  async readAll(): Promise<void> {
    try {
      const unread = this.store.data().notifications.filter((item) => !item.read);
      await Promise.all(unread.map((item) => firstValueFrom(this.api.markNotificationRead(item.id))));
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('notifications.bulkUpdateError'));
      return;
    }

    this.store.data.update((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
  }

  async mark(id: string): Promise<void> {
    this.marcando.update((actual) => new Set(actual).add(id));
    try {
      await firstValueFrom(this.api.markNotificationRead(id));
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('notifications.updateError'));
      return;
    } finally {
      this.marcando.update((actual) => {
        const siguiente = new Set(actual);
        siguiente.delete(id);
        return siguiente;
      });
    }

    this.store.data.update((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }
}
