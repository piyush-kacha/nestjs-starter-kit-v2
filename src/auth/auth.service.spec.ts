import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';
import { User as PrismaUser } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');

// Define a type for the mocked UsersService if you need specific method mocks
// Otherwise, Jest's auto-mocking or a simple object can be used.
const mockUsersService = {
  findByUsername: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: typeof mockUsersService;
  let jwtService: typeof mockJwtService;
  let mockedBcryptCompare: jest.MockedFunction<typeof bcrypt.compare>;


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
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    
    // Setup bcrypt.compare mock
    mockedBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

    // Reset mocks before each test
    usersService.findByUsername.mockReset();
    usersService.create.mockReset();
    jwtService.sign.mockReset();
    mockedBcryptCompare.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    const signInDto: SignInDto = { username: 'testuser', password: 'password123' };

    it('should return user object (without passwordHash) for valid credentials', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);
      mockedBcryptCompare.mockResolvedValue(true as never); // Cast to never if type issues with boolean

      const result = await service.validateUser(signInDto);
      expect(result).toEqual(userWithoutPasswordHash);
      expect(usersService.findByUsername).toHaveBeenCalledWith(signInDto.username);
      expect(mockedBcryptCompare).toHaveBeenCalledWith(signInDto.password, mockUser.passwordHash);
    });

    it('should return null if username is not found', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      const result = await service.validateUser(signInDto);
      expect(result).toBeNull();
      expect(usersService.findByUsername).toHaveBeenCalledWith(signInDto.username);
      expect(mockedBcryptCompare).not.toHaveBeenCalled();
    });

    it('should return null if password does not match', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);
      mockedBcryptCompare.mockResolvedValue(false as never);

      const result = await service.validateUser(signInDto);
      expect(result).toBeNull();
      expect(usersService.findByUsername).toHaveBeenCalledWith(signInDto.username);
      expect(mockedBcryptCompare).toHaveBeenCalledWith(signInDto.password, mockUser.passwordHash);
    });
  });

  describe('signup', () => {
    const createUserDto: CreateUserDto = { username: 'newuser', password: 'newpassword123' };
    const newUser = { id: 'user-id-2', username: 'newuser', createdAt: new Date(), updatedAt: new Date() };


    it('should successfully create a new user', async () => {
      usersService.findByUsername.mockResolvedValue(null); // No existing user
      usersService.create.mockResolvedValue(newUser);

      const result = await service.signup(createUserDto);
      expect(result).toEqual(newUser);
      expect(usersService.findByUsername).toHaveBeenCalledWith(createUserDto.username);
      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
    });

    it('should throw ConflictException if username already exists', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser); // User already exists

      await expect(service.signup(createUserDto)).rejects.toThrow(ConflictException);
      expect(usersService.findByUsername).toHaveBeenCalledWith(createUserDto.username);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should propagate error if usersService.create fails', async () => {
        usersService.findByUsername.mockResolvedValue(null);
        const createError = new Error("DB error");
        usersService.create.mockRejectedValue(createError);

        await expect(service.signup(createUserDto)).rejects.toThrow(createError);
    });
  });

  describe('signin', () => {
    const userToSign = { ...userWithoutPasswordHash }; // Use the one without passwordHash
    const accessToken = 'mockAccessToken';

    it('should return an access token for a valid user', async () => {
      jwtService.sign.mockReturnValue(accessToken);

      const result = await service.signin(userToSign);
      expect(result).toEqual({ accessToken });
      expect(jwtService.sign).toHaveBeenCalledWith({
        username: userToSign.username,
        sub: String(userToSign.id), // Ensure ID is stringified as in service
      });
    });
  });
});
