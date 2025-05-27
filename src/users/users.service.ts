import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/db.service'; // Correct path to PrismaService
import { CreateUserDto } from '../auth/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { User as PrismaUser } from '@prisma/client'; // Import Prisma's User type

@Injectable()
export class UsersService {
  constructor(private db: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<PrismaUser, 'passwordHash'>> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);
    
    const newUser = await this.db.user.create({
      data: {
        username: createUserDto.username,
        passwordHash: passwordHash,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async findByUsername(username: string): Promise<PrismaUser | null> {
    return this.db.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<PrismaUser | null> {
    return this.db.user.findUnique({
      where: { id },
    });
  }
}
