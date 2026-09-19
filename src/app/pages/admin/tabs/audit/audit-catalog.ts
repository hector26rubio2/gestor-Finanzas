export const AUDIT_ACTIONS: readonly string[] = [
  'account.created',
  'account.opened',
  'account.updated',
  'capability.override',
  'card.created',
  'card.updated',
  'category.created',
  'category.updated',
  'feature_flag.override',
  'feature_flag.updated',
  'investment.created',
  'investment.updated',
  'member.invited',
  'movement.created',
  'movement.reclassified',
  'movement.reversed',
  'organization.created',
  'organization.default.set',
  'organization.updated',
  'permission.description.updated',
  'person.created',
  'person.updated',
  'preferences.updated',
  'preferences.dashboard_layout.updated',
  'recurrence.created',
  'recurrence.materialized',
  'role.activated',
  'role.deactivated',
  'role.created',
  'role.deleted',
  'role.updated',
  'settlement.issued',
  'shared_purchase.created',
  'user.disabled',
  'user.enabled',
  'user.joined',
  'user.organization.joined',
  'user.organization.left',
  'user.roles',
];

export const AUDIT_ENTITIES: readonly string[] = [
  'Account',
  'Card',
  'Category',
  'FeatureFlag',
  'feature_flag',
  'Investment',
  'Movement',
  'Person',
  'Recurrence',
  'Settlement',
  'SharedPurchase',
  'UserPreference',
  'organization',
  'permission',
  'role',
  'user',
];

export function prettyJson(raw: string | null): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function startOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

export function endOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}
