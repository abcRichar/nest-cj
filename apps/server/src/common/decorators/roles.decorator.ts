import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@elp/shared';

export const ROLES_KEY = 'roles';

/** 角色校验：@Roles(UserRole.ADMIN) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
