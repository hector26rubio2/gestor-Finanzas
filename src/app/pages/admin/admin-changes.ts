export type AdminChange =
  | { kind: 'userActive'; userId: string; value: boolean }
  | { kind: 'userRoles'; userId: string; organizationId: string; roleIds: readonly string[] }
  | { kind: 'userOrganization'; userId: string; organizationId: string }
  | { kind: 'roleActive'; roleId: string; value: boolean }
  | { kind: 'flag'; key: string; organizationId: string | null; userId: string | null; value: boolean }
  | { kind: 'organizationActive'; organizationId: string; value: boolean }
  | { kind: 'organizationDefault'; organizationId: string };

export type AdminChangeKind = AdminChange['kind'];

export function changeKey(change: AdminChange): string {
  switch (change.kind) {
    case 'userActive':
      return `userActive:${change.userId}`;
    case 'userRoles':
      return `userRoles:${change.userId}:${change.organizationId}`;
    case 'userOrganization':
      return `userOrganization:${change.userId}`;
    case 'roleActive':
      return `roleActive:${change.roleId}`;
    case 'flag':
      return `flag:${change.key}:${change.organizationId ?? '-'}:${change.userId ?? '-'}`;
    case 'organizationActive':
      return `organizationActive:${change.organizationId}`;
    case 'organizationDefault':
      return 'organizationDefault';
  }
}

export function changeWave(change: AdminChange): 1 | 2 | 3 | 4 {
  switch (change.kind) {
    case 'organizationActive':
      return change.value ? 1 : 3;
    case 'organizationDefault':
    case 'userOrganization':
      return 2;
    default:
      return 4;
  }
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function affectsAccess(change: AdminChange): boolean {
  return change.kind !== 'flag' && change.kind !== 'organizationDefault';
}
