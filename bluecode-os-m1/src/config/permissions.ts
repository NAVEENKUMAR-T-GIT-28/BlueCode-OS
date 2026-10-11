export const permissionMatrix = {
  'workspace:read': ['owner', 'admin', 'member'],
  'workspace:settings': ['owner', 'admin'],
  'member:invite': ['owner', 'admin'],
  'member:role': ['owner', 'admin'],
  'workspace:plan': ['owner'],
  'workspace:delete': ['owner'],
  'icp:write': ['owner', 'admin', 'member'],
  'prospect:search': ['owner', 'admin', 'member'],
  'prospect:score': ['owner', 'admin', 'member'],
  'contact:enrich': ['owner', 'admin', 'member'],
  'message:draft': ['owner', 'admin', 'member'],
  'message:edit': ['owner', 'admin', 'member'],
  'message:approve': ['owner', 'admin'],
  'campaign:approve': ['owner', 'admin'],
  'message:handoff': ['owner', 'admin'],
  'activity:log': ['owner', 'admin', 'member'],
  'nba:act': ['owner', 'admin', 'member'],
  'prospect:mark_dnc': ['owner', 'admin', 'member'],
  'prospect:clear_dnc': ['owner', 'admin'],
} as const;

export type Permission = keyof typeof permissionMatrix;
export type WorkspaceRole = 'owner' | 'admin' | 'member';

export function permissionsForRole(role: WorkspaceRole): Permission[] {
  return (Object.keys(permissionMatrix) as Permission[])
    .filter(permission => (permissionMatrix[permission] as readonly string[]).includes(role));
}
