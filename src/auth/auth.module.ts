import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { jwtConfig } from '../config/jwt.config';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { LocalStrategy } from './strategies/local.strategy'; // Import LocalStrategy
import { JwtStrategy } from './strategies/jwt.strategy'; // Import JwtStrategy

@Module({
  imports: [
    PassportModule,
    UsersModule, // Add UsersModule here
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        privateKey: configService.get<string>('JWT_PRIVATE_KEY'),
        publicKey: configService.get<string>('JWT_PUBLIC_KEY'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION_TIME'),
          algorithm: 'RS256', // Explicitly set algorithm here for generation
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy], // Add strategies to providers
})
export class AuthModule {}
