import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { configuration } from "./config";
import { LoggerModule } from "nestjs-pino";
import { getLoggerConfig } from "./app.config";

@Module({
  imports: [
    // Configure environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Make the configuration global
      load: [configuration], // Load the environment variables from the configuration file
    }),

    // Configure logging
    LoggerModule.forRoot(getLoggerConfig()), // ! forRootAsync is not working with ConfigService in nestjs-pino
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
