import { ApiProperty } from "@nestjs/swagger";
import { Access } from "@prisma/client";

export class AccessEntity implements Access {
  @ApiProperty({ description: "The unique identifier" })
  id: string;

  @ApiProperty({ description: "Access's role" })
  role: string;

  @ApiProperty({ description: "Access's userId" })
  userId: string;

  @ApiProperty({ description: "Access's workspaceId" })
  workspaceId: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date | null;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date | null;
}
