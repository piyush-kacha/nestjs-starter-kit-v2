import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../db/db.service';

@Injectable()
export class WorkspaceRepository {
  private readonly logger = new Logger(WorkspaceRepository.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(name: string) {
    try {
      return await this.prismaService.workspace.create({
        data: {
          name,
        },
      });
    } catch (error) {
      this.logger.error('Failed to creating workspace ', error?.stack, error?.message);
    }
  }
}
