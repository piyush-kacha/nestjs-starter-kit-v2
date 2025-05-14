import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

@Module({
  providers: [WorkspaceService]
})
export class WorkspaceModule {}
