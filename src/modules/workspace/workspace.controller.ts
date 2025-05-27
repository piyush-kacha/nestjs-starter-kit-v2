import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Adjusted path
import { RolesGuard } from '../../auth/guards/roles.guard'; // Import RolesGuard
import { Roles } from '../../auth/decorators/roles.decorator'; // Import Roles decorator
import { Role } from '../../shared/enums/role.enum'; // Import Role enum
import { User as AuthUser } from '../../auth/decorators/user.decorator'; // Adjusted path
import { User as PrismaUser } from '@prisma/client'; // For typing req.user

@UseGuards(JwtAuthGuard, RolesGuard) // Apply RolesGuard globally after JwtAuthGuard
@Controller('workspaces') // Changed route to 'workspaces' for RESTful conventions
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async create(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @AuthUser() user: Omit<PrismaUser, 'passwordHash'>,
  ) {
    return this.workspaceService.create(createWorkspaceDto, user.id);
  }

  @Get()
  async findAllAccessible(@AuthUser() user: Omit<PrismaUser, 'passwordHash'>) {
    return this.workspaceService.findAllAccessible(user.id);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.MEMBER) // Accessible by Owner, Admin, or Member
  async findOne(
    @Param('id') id: string,
    @AuthUser() user: Omit<PrismaUser, 'passwordHash'>,
  ) {
    // WorkspaceService.findOne will be updated to check roles
    const workspace = await this.workspaceService.findOne(id, user.id);
    if (!workspace) {
      throw new NotFoundException(`Workspace with ID "${id}" not found or access denied.`);
    }
    return workspace;
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN) // Requires Owner or Admin role
  async update(
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @AuthUser() user: Omit<PrismaUser, 'passwordHash'>,
  ) {
    // WorkspaceService.update will be updated to check roles
    return this.workspaceService.update(id, updateWorkspaceDto, user.id);
  }

  @Delete(':id')
  @Roles(Role.OWNER) // Requires Owner role
  @HttpCode(HttpStatus.NO_CONTENT) 
  async remove(
    @Param('id') id: string,
    @AuthUser() user: Omit<PrismaUser, 'passwordHash'>,
  ) {
    // WorkspaceService.remove will be updated to check roles
    await this.workspaceService.remove(id, user.id);
  }
}
