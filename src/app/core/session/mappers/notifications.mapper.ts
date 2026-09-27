import { ViewData } from '@core/state/view-model';
import { ApiNotification } from '@core/api/api-client';

export function toViewNotification(notification: ApiNotification): ViewData['notifications'][number] {
  return {
    id: notification.id,
    title: notification.title,
    detail: notificationDetail(notification),
    read: notification.readAt !== null,
  };
}

export function notificationDetail(notification: ApiNotification): string {
  try {
    const payload = JSON.parse(notification.payloadJson) as Record<string, unknown>;
    return String(payload['detail'] ?? payload['description'] ?? notification.kind);
  } catch {
    return notification.kind;
  }
}
