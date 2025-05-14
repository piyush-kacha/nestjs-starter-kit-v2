import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./db.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DbModule {}
