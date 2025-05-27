import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service'; // Adjust path as needed
import { User as PrismaUser } from '@prisma/client'; // Import PrismaUser

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService, // Inject UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_PUBLIC_KEY'), // Use public key for verification
      algorithms: ['RS256'], // Specify the algorithm
    });
  }

  async validate(payload: any): Promise<Omit<PrismaUser, 'passwordHash'> | null> {
    // The payload will contain the user id and username (or whatever you put into it during signin)
    // You can use this to fetch the full user object if needed, or just return a subset
    const user = await this.usersService.findById(payload.sub); // 'sub' is standard for user id in JWT
    if (!user) {
      return null; // Or throw an exception
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result; // This will be attached to request.user
  }
}
