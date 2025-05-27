import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../db/db.service'; // Correct path to PrismaService
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { Workspace, User, Access } from '@prisma/client'; // Import Prisma types
import { Role } from '../../shared/enums/role.enum'; // Import Role enum

@Injectable()
export class WorkspaceService {
  constructor(private db: PrismaService) {}

  async create(createWorkspaceDto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    return this.db.$transaction(async (prisma) => {
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
          ownerId: userId,
        },
      });

      await prisma.access.create({
        data: {
          userId: userId,
          workspaceId: newWorkspace.id,
          role: Role.OWNER, // Assign OWNER role
        },
      });

      return newWorkspace;
    });
  }

  // Old method, can be kept for specific use cases or removed if not needed
  async findAllByOwner(userId: string): Promise<Workspace[]> {
    return this.db.workspace.findMany({
      where: {
        ownerId: userId,
      },
    });
  }

  async findAllAccessible(userId: string): Promise<Workspace[]> {
    const accessGrants = await this.db.access.findMany({
      where: { userId },
      include: { workspace: true }, // Include the related workspace data
    });
    return accessGrants.map(ag => ag.workspace);
  }

  async findOne(id: string, userId: string): Promise<Workspace | null> {
    // This method is now primarily for role-based access check via RolesGuard.
    // The guard will determine if the user has ANY valid role.
    // If the guard passes, the user has some access. We then fetch the workspace.
    // The specific roles required (OWNER, ADMIN, MEMBER) are defined in the controller.
    
    // First, ensure the workspace actually exists.
    const workspace = await this.db.workspace.findUnique({
      where: { id: id },
    });

    if (!workspace) {
      // This will be caught by controller and result in 404
      return null; 
    }
    
    // The RolesGuard has already verified that the user (userId) has one of the
    // roles specified in the @Roles() decorator for this workspace (id).
    // So, we can directly return the workspace.
    // If specific logic for findOne beyond role check is needed (e.g. based on workspace status),
    // it can be added here. For now, direct return is fine.
    return workspace;
  }

  async update(id: string, updateWorkspaceDto: UpdateWorkspaceDto, userId: string): Promise<Workspace> {
    // RolesGuard (OWNER, ADMIN) has already verified the user's permission.
    // We just need to ensure the workspace exists before updating.
    const existingWorkspace = await this.db.workspace.findUnique({
      where: { id: id },
    });

    if (!existingWorkspace) {
      throw new NotFoundException(`Workspace with ID "${id}" not found.`);
    }

    // Note: userId is passed but not strictly needed here anymore for auth,
    // as RolesGuard handles it. It could be used for logging/auditing if required.
    return this.db.workspace.update({
      where: { id: id },
      data: updateWorkspaceDto,
    });
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    // RolesGuard (OWNER) has already verified the user's permission.
    // We just need to ensure the workspace exists before deleting.
    const existingWorkspace = await this.db.workspace.findUnique({
      where: { id: id },
    });

    if (!existingWorkspace) {
      throw new NotFoundException(`Workspace with ID "${id}" not found.`);
    }

    // Note: userId is passed but not strictly needed here for auth.
    // Cascade delete for Access records should be handled by Prisma schema.
    await this.db.workspace.delete({
      where: { id: id },
    });
    return { message: `Workspace with ID "${id}" deleted successfully.` };
  }
}
