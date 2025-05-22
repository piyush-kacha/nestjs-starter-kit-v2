import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { APP_FILTER } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { getLoggerConfig } from "./app.config";
import { configuration } from "./config";

import { AllExceptionsFilter } from "./exception-filters/all-exception.filter";
// HttpExceptionsFilter and UnauthorizedExceptionsFilter will be removed

import { WorkspaceModule } from "./modules/workspace/workspace.module";
import { DbModule } from "./db/db.module";
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Configure environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Make the configuration global
      load: [configuration], // Load the environment variables from the configuration file
    }),
    // Configure logging
    LoggerModule.forRoot(getLoggerConfig()),

    DbModule,
    WorkspaceModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter }, // Only AllExceptionsFilter remains
    AppService,
  ],
})
export class AppModule {}
