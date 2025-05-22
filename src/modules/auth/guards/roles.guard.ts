import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../../shared/enums/role.enum';
import { PrismaService } from '../../../db/db.service'; // Adjusted path
import { User as PrismaUser } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles are required, access granted
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as Omit<PrismaUser, 'passwordHash'>; // User from JwtAuthGuard

    if (!user) {
      // This should ideally not happen if JwtAuthGuard is applied before RolesGuard
      throw new ForbiddenException('User not authenticated.');
    }

    // Extract workspaceId from request parameters
    // Common parameter names are 'id' or 'workspaceId'. Adjust if different.
    const workspaceId = request.params.id || request.params.workspaceId;

    if (!workspaceId) {
      // If workspaceId is not present in params, this guard might not be applicable
      // or it's a misconfiguration. For now, deny access.
      throw new ForbiddenException('Workspace ID not provided in request parameters.');
    }

    const accessRecord = await this.db.access.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceId,
        role: {
          in: requiredRoles,
        },
      },
    });

    if (!accessRecord) {
      throw new ForbiddenException('You do not have the required roles for this workspace.');
    }

    return true; // User has one of the required roles
  }
}
