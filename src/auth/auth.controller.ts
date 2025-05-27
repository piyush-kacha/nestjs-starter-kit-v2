import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto'; // Correct DTO for signin
import { Public } from './decorators/public.decorator';
import { User } from './decorators/user.decorator'; // User decorator
import { AuthGuard } from '@nestjs/passport'; // For AuthGuard('local')
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // For JwtAuthGuard
// User as UserEntity from Prisma
import { User as PrismaUser } from '@prisma/client'; // Import PrismaUser
import { plainToClass } from 'class-transformer'; // Import plainToClass
import { UserDto } from '../users/dto/user.dto.ts'; // Import UserDto, adjust path as needed

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    // AuthService.signup returns Omit<PrismaUser, 'passwordHash'>
    // If we want to return UserDto here as well, we can transform it.
    const user = await this.authService.signup(createUserDto);
    return plainToClass(UserDto, user, { excludeExtraneousValues: true });
  }

  @Public()
  @UseGuards(AuthGuard('local')) // Use passport-local strategy
  @Post('signin')
  async signin(@Request() req: any) { 
    // req.user is Omit<PrismaUser, 'passwordHash'> from LocalStrategy/AuthService.validateUser
    // AuthService.signin expects this type and returns { accessToken: string }
    // No transformation needed for the request to authService.signin or its response.
    return this.authService.signin(req.user);
  }

  @UseGuards(JwtAuthGuard) // Protect with JWT guard
  @Get('profile')
  getProfile(@AuthUser() user: Omit<PrismaUser, 'passwordHash'>): UserDto { // Use custom @User decorator, user is Omit<PrismaUser, 'passwordHash'>
    // The 'user' object from @AuthUser decorator is already Omit<PrismaUser, 'passwordHash'>
    // as returned by JwtStrategy.validate
    return plainToClass(UserDto, user, { excludeExtraneousValues: true });
  }
}
