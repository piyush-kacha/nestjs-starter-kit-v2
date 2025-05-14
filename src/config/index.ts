import { IDatabaseConfig, databaseConfig } from "./database.config";
import { IJwtConfig, jwtConfig } from "./jwt.config";
import { NodeEnv } from "../shared/enums/node-env.enum";

export interface Config {
  env: string;
  port: number;
  host: string;
  logLevel: string;
  clustering: string;
  database: IDatabaseConfig;
  jwt: IJwtConfig;
}

export const configuration = (): Partial<Config> => ({
  env: process.env.NODE_ENV || NodeEnv.Development,
  port: Number.parseInt(process.env.PORT, 10) || 3009,
  host: process.env.HOST || "127.0.0.1",
  logLevel: process.env.LOG_LEVEL,
  clustering: process.env.CLUSTERING,
  database: databaseConfig(),
  jwt: jwtConfig(),
});
