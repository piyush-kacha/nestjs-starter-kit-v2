// Import external modules
import cluster from "node:cluster";
import os from "node:os";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger as Pino } from "nestjs-pino";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";

// Import internal modules
import { AppModule } from "./app.module";

// Create a logger for the bootstrap process
const logger = new Logger("bootstrap");

// Define the main function
async function bootstrap() {
  // Create the NestJS application instance
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use the Pino logger for the application
  app.useLogger(app.get(Pino));

  // Allow all origins
  app.enableCors();

  // Define the Swagger options and document
  const options = new DocumentBuilder()
    .setTitle("NestJS Starter API")
    .setDescription("The API for the NestJS Starter project")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);

  app.use(
    "/docs",
    apiReference({
      spec: {
        content: document,
      },
    })
  );

  // Get the configuration service from the application
  const configService = app.get(ConfigService);

  // Get the port number from the configuration
  const port = configService.get<number>("port");

  // Setup global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Enable transformation
      whitelist: true, // Strip properties not defined in DTO
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Allow conversion of primitive types
      },
    }),
  );

  // Start the application
  await app.listen(port);

  // Log a message to indicate that the application is running
  logger.log(`Application listening on port ${port}`);
}

// Check if clustering is enabled
if (process.env.CLUSTERING === "true") {
  // Get the number of CPUs on the machine
  const NUM_CPUS = os.cpus().length;

  // If the current process is the master process
  if (cluster.isPrimary) {
    logger.log(`Master process is running with PID ${process.pid}`);

    // Fork workers for each available CPU
    for (let i = 0; i < NUM_CPUS; i += 1) {
      cluster.fork();
    }

    // Log when a worker process exits
    cluster.on("exit", (worker, code, signal) => {
      logger.debug(
        `Worker process ${worker.process.pid} exited with code ${code} and signal ${signal}`
      );
    });
  } else {
    // If the current process is a worker process, call the bootstrap function to start the application
    bootstrap();
  }
} else {
  // Call the bootstrap function to start the application
  bootstrap();
}
