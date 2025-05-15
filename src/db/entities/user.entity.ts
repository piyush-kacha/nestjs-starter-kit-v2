import { ApiProperty } from "@nestjs/swagger";
import { User } from "@prisma/client";

export class UserEntity implements User {
  @ApiProperty({ description: "The unique identifier" })
  id: string;

  @ApiProperty({ description: "Email address" })
  email: string;

  @ApiProperty({ description: "User password" })
  password: string | null;

  @ApiProperty({ description: "User's verified" })
  verified: boolean;

  @ApiProperty({ description: "User's verificationCode" })
  verificationCode: string;

  @ApiProperty({ description: "User's verificationCodeExpiry" })
  verificationCodeExpiry: Date | null;

  @ApiProperty({ description: "User's registerCode" })
  registerCode: string | null;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;
}
