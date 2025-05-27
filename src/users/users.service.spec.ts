import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../db/db.service';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { User as PrismaUser } from '@prisma/client';
// Removed ConflictException as it's not thrown by UsersService.create directly

// Mock bcrypt
jest.mock('bcrypt');

// Mock PrismaService
const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  // Mock other models if UsersService starts using them
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;
  let mockedBcryptHash: jest.MockedFunction<typeof bcrypt.hash>;

  const mockUser: PrismaUser = {
    id: 'user-id-1',
    username: 'testuser',
    passwordHash: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userWithoutPasswordHash = {
    id: mockUser.id,
    username: mockUser.username,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

    // Reset mocks before each test
    prisma.user.create.mockReset();
    prisma.user.findUnique.mockReset();
    mockedBcryptHash.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = { username: 'newuser', password: 'newpassword123' };
    const hashedPassword = 'hashedNewPassword';
    const createdUserFromDb: PrismaUser = {
      id: 'user-id-2',
      username: 'newuser',
      passwordHash: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const expectedUserResult = { // without passwordHash
      id: createdUserFromDb.id,
      username: createdUserFromDb.username,
      createdAt: createdUserFromDb.createdAt,
      updatedAt: createdUserFromDb.updatedAt,
    };

    it('should successfully create a new user', async () => {
      mockedBcryptHash.mockResolvedValue(hashedPassword);
      prisma.user.create.mockResolvedValue(createdUserFromDb);

      const result = await service.create(createUserDto);

      expect(mockedBcryptHash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: createUserDto.username,
          passwordHash: hashedPassword,
        },
      });
      expect(result).toEqual(expectedUserResult);
    });

    it('should propagate error if bcrypt.hash fails', async () => {
        const hashError = new Error("Hashing failed");
        mockedBcryptHash.mockRejectedValue(hashError);
        await expect(service.create(createUserDto)).rejects.toThrow(hashError);
        expect(prisma.user.create).not.toHaveBeenCalled();
    });
    
    it('should propagate error if prisma.user.create fails', async () => {
        mockedBcryptHash.mockResolvedValue(hashedPassword);
        const dbError = new Error("Database create failed");
        prisma.user.create.mockRejectedValue(dbError);
        await expect(service.create(createUserDto)).rejects.toThrow(dbError);
    });
  });

  describe('findByUsername', () => {
    const username = 'testuser';

    it('should return user object if user is found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByUsername(username);
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username },
      });
    });

    it('should return null if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByUsername(username);
      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username },
      });
    });
  });

  describe('findById', () => {
    const userId = 'user-id-1';

    it('should return user object if user is found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(userId);
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should return null if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById(userId);
      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });
  });
});
