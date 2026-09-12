import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

export interface ApiNotification {
  id: string;
  kind: string;
  title: string;
  payloadJson: string;
  readAt: string | null;
  createdAt: string;
}

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
