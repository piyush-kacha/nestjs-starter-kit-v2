import { ApiProperty } from "@nestjs/swagger";
import { Workspace } from "@prisma/client";

export class WorkspaceEntity implements Workspace {
  @ApiProperty({ description: "The unique identifier" })
  id: string;

  @ApiProperty({ description: "Name" })
  name: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;
}
