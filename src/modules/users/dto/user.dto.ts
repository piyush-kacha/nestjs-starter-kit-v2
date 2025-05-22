import { Exclude, Expose } from 'class-transformer';

@Exclude() // Exclude all properties by default
export class UserDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  // Add any other fields that should be exposed in API responses
  // Example:
  // @Expose()
  // email: string; // If your User model has email and you want to expose it

  // Note: passwordHash should NOT be exposed.
  // createdAt and updatedAt can also be exposed if desired.
  // @Expose()
  // createdAt: Date;
  // @Expose()
  // updatedAt: Date;
}
