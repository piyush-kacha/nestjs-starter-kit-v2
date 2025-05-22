import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User as PrismaUser } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(signInDto: SignInDto): Promise<Omit<PrismaUser, 'passwordHash'> | null> {
    const user = await this.usersService.findByUsername(signInDto.username);
    if (user && await bcrypt.compare(signInDto.password, user.passwordHash)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async signup(createUserDto: CreateUserDto): Promise<Omit<PrismaUser, 'passwordHash'>> {
    const existingUser = await this.usersService.findByUsername(createUserDto.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }
    // UsersService.create now returns Promise<Omit<PrismaUser, 'passwordHash'>>
    return this.usersService.create(createUserDto);
  }

  async signin(user: Omit<PrismaUser, 'passwordHash'>): Promise<{ accessToken: string }> {
    // Ensure user.id is a string as Prisma IDs are typically strings
    const payload = { username: user.username, sub: String(user.id) };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
