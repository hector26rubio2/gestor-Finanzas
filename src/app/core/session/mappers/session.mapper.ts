import { SessionUser } from '@core/state/view-model';
import { ApiSession } from '@core/api/api-client';

export function toViewUser(session: ApiSession): SessionUser {
  return {
    id: session.user.id,
    name: session.user.displayName,
    email: session.user.email,
    capabilities: [...(session.permissions ?? [])],
    photoUrl: session.user.pictureUrl ?? undefined,
  };
}
