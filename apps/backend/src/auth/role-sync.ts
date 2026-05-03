import type { UserRole } from '@prisma/client';

export interface RoleSyncConfig {
  memberGroup: string;
  adminGroup: string;
}

export class NotMemberError extends Error {
  constructor() {
    super('User is not a member of the Velvet Scoop group');
    this.name = 'NotMemberError';
  }
}

export interface RoleSyncResult {
  role: UserRole;
}

export function syncRole(groups: ReadonlyArray<string>, cfg: RoleSyncConfig): RoleSyncResult {
  const isAdmin = groups.includes(cfg.adminGroup);
  const isMember = groups.includes(cfg.memberGroup);

  if (!isAdmin && !isMember) {
    throw new NotMemberError();
  }

  return { role: isAdmin ? 'admin' : 'member' };
}
