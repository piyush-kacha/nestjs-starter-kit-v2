import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../../db/db.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { Role } from '../../shared/enums/role.enum';
import { Workspace, Access, User } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

// Mock PrismaService
const mockPrismaService = {
  workspace: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(), // Used by findOne, update, remove for existence check
    findFirst: jest.fn(), // If used (findOne currently uses findUnique)
    update: jest.fn(),
    delete: jest.fn(),
  },
  access: {
    create: jest.fn(),
    findMany: jest.fn(),
    // findFirst: jest.fn(), // If needed for specific access checks within service
  },
  $transaction: jest.fn(),
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: typeof mockPrismaService;

  const mockUserId = 'user-id-1';
  const mockWorkspaceId = 'workspace-id-1';

  const mockWorkspace: Workspace = {
    id: mockWorkspaceId,
    name: 'Test Workspace',
    description: 'A test workspace',
    ownerId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    prisma = module.get(PrismaService);

    // Reset mocks before each test
    prisma.workspace.create.mockReset();
    prisma.workspace.findMany.mockReset();
    prisma.workspace.findUnique.mockReset();
    prisma.workspace.findFirst.mockReset();
    prisma.workspace.update.mockReset();
    prisma.workspace.delete.mockReset();
    prisma.access.create.mockReset();
    prisma.access.findMany.mockReset();
    prisma.$transaction.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createWorkspaceDto: CreateWorkspaceDto = { name: 'New Workspace', description: 'Description' };
    
    it('should successfully create a new workspace and assign OWNER role', async () => {
      // Mock the $transaction callback
      prisma.$transaction.mockImplementation(async (callback) => {
        // Simulate the operations within the transaction
        const createdWorkspace = { ...mockWorkspace, ...createWorkspaceDto, ownerId: mockUserId, id: 'new-ws-id' };
        mockPrismaService.workspace.create.mockResolvedValue(createdWorkspace); // Mock for inside transaction
        mockPrismaService.access.create.mockResolvedValue({} as Access); // Mock for inside transaction
        return callback(mockPrismaService); // Pass the mocked prisma client to the callback
      });

      const result = await service.create(createWorkspaceDto, mockUserId);

      expect(prisma.$transaction).toHaveBeenCalled();
      // Check that workspace.create was called (via the transaction mock)
      expect(mockPrismaService.workspace.create).toHaveBeenCalledWith({
        data: {
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
          ownerId: mockUserId,
        },
      });
      // Check that access.create was called (via the transaction mock)
      expect(mockPrismaService.access.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          workspaceId: 'new-ws-id', // ID from the created workspace
          role: Role.OWNER,
        },
      });
      expect(result.name).toBe(createWorkspaceDto.name);
    });

    it('should propagate error if $transaction fails', async () => {
        const dbError = new Error("Transaction failed");
        prisma.$transaction.mockRejectedValue(dbError);
        await expect(service.create(createWorkspaceDto, mockUserId)).rejects.toThrow(dbError);
    });
  });

  describe('findAllAccessible', () => {
    it('should return workspaces user has access to', async () => {
      const mockAccessGrants = [
        { userId: mockUserId, workspaceId: 'ws-id-1', role: Role.MEMBER, workspace: { ...mockWorkspace, id: 'ws-id-1', name: 'WS1' } },
        { userId: mockUserId, workspaceId: 'ws-id-2', role: Role.ADMIN, workspace: { ...mockWorkspace, id: 'ws-id-2', name: 'WS2' } },
      ] as (Access & { workspace: Workspace })[];
      prisma.access.findMany.mockResolvedValue(mockAccessGrants);

      const result = await service.findAllAccessible(mockUserId);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('WS1');
      expect(result[1].name).toBe('WS2');
      expect(prisma.access.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { workspace: true },
      });
    });

    it('should return an empty array if user has no accessible workspaces', async () => {
      prisma.access.findMany.mockResolvedValue([]);
      const result = await service.findAllAccessible(mockUserId);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return workspace if it exists (assuming RolesGuard passed)', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      const result = await service.findOne(mockWorkspaceId, mockUserId);
      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: mockWorkspaceId } });
    });

    it('should return null if workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      const result = await service.findOne(mockWorkspaceId, mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateWorkspaceDto: UpdateWorkspaceDto = { name: 'Updated Workspace Name' };
    const updatedWorkspace = { ...mockWorkspace, ...updateWorkspaceDto };

    it('should update workspace if it exists (assuming RolesGuard passed)', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace); // Workspace exists
      prisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await service.update(mockWorkspaceId, updateWorkspaceDto, mockUserId);
      expect(result).toEqual(updatedWorkspace);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: mockWorkspaceId } });
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: mockWorkspaceId },
        data: updateWorkspaceDto,
      });
    });

    it('should throw NotFoundException if workspace does not exist for update', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null); // Workspace does not exist
      await expect(service.update(mockWorkspaceId, updateWorkspaceDto, mockUserId)).rejects.toThrow(NotFoundException);
      expect(prisma.workspace.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove workspace if it exists (assuming RolesGuard passed)', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace); // Workspace exists
      prisma.workspace.delete.mockResolvedValue(mockWorkspace); // Simulate successful deletion

      const result = await service.remove(mockWorkspaceId, mockUserId);
      expect(result).toEqual({ message: `Workspace with ID "${mockWorkspaceId}" deleted successfully.` });
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: mockWorkspaceId } });
      expect(prisma.workspace.delete).toHaveBeenCalledWith({ where: { id: mockWorkspaceId } });
    });

    it('should throw NotFoundException if workspace does not exist for removal', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null); // Workspace does not exist
      await expect(service.remove(mockWorkspaceId, mockUserId)).rejects.toThrow(NotFoundException);
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
    });
  });
});
