import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger("PrismaService");

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Connected to the database");
    } catch (error) {
      this.logger.error(error, "Failed to connect to the database");
    }
  }
}
