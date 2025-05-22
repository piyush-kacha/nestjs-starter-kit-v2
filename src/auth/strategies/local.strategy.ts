import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { SignInDto } from '../dto/sign-in.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'username' }); // Assumes username is used for login
  }

  async validate(username: string, pass: string): Promise<any> {
    // The DTO expects username and password, but passport-local sends them as separate args.
    // We'll create a SignInDto object here for consistency with AuthService.validateUser
    const signInDto: SignInDto = { username, password: pass };
    const user = await this.authService.validateUser(signInDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
