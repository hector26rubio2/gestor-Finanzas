import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import type { EsquemaApi } from './generado/esquemas';

export type ApiNotification = EsquemaApi<'NotificationDto'>;

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly transport = inject(API_TRANSPORT);

  notifications(unreadOnly = false) {
    return this.transport.request<readonly ApiNotification[]>({
      method: 'GET',
      path: API_ROUTES.notifications,
      params: { unreadOnly },
    });
  }

  markNotificationRead(id: string, isRead = true) {
    return this.transport.request<ApiNotification>({
      method: 'PUT',
      path: API_ROUTES.notificationRead(id),
      body: { isRead },
    });
  }
}
