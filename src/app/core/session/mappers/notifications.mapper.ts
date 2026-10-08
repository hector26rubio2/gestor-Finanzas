import { ViewData } from '@core/state/view-model';
import { ApiNotification } from '@core/api/api-client';
import { I18nService } from '@core/i18n';

export function toViewNotification(
  i18n: I18nService,
  notification: ApiNotification,
): ViewData['notifications'][number] {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notificationTitle(i18n, notification),
    detail: notificationDetail(i18n, notification),
    read: notification.readAt !== null,
    createdAt: notification.createdAt,
  };
}

export function notificationTitle(i18n: I18nService, notification: ApiNotification): string {
  const key = `notifications.kind.${notification.kind}.title`;
  const translated = i18n.t(key);
  return translated === key ? notification.title : translated;
}

export function notificationDetail(i18n: I18nService, notification: ApiNotification): string {
  const payload = payloadOf(notification);
  if (notification.kind === 'organization.updated' && typeof payload?.['organizationName'] === 'string')
    return i18n.t('notifications.kind.organization.updated.detail', {
      organization: payload['organizationName'],
    });
  if (notification.kind === 'roles.updated') {
    if (payload?.['removed'] === true) return i18n.t('notifications.kind.roles.updated.removed');
    if (Array.isArray(payload?.['roleNames']))
      return i18n.t('notifications.kind.roles.updated.detail', {
        roles: payload['roleNames'].filter((value): value is string => typeof value === 'string').join(', '),
      });
  }

  return legacyNotificationDetail(notification, payload);
}

function payloadOf(notification: ApiNotification): Record<string, unknown> | null {
  try {
    const payload = JSON.parse(notification.payloadJson) as unknown;
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function legacyNotificationDetail(notification: ApiNotification, payload: Record<string, unknown> | null): string {
  return String(payload?.['detail'] ?? payload?.['description'] ?? notification.kind);
}
