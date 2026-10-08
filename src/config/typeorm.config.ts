import * as dotenv from "dotenv";
import { join } from "path";
import { DataSource, DataSourceOptions } from "typeorm";

dotenv.config();

const ENTITIES = [join(__dirname, "../**/*.entity{.ts,.js}")];
const MIGRATIONS = [join(__dirname, "../typeorm/migrations/*{.ts,.js}")];

// The typeorm CLI requires the data-source file to export exactly ONE
// DataSource instance (named + default both count), so keep default only.
const AppDataSource = new DataSource({
  type: (process.env.DB_TYPE || "postgres") as any,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "chat_server",
  schema: process.env.DB_SCHEMA,
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: Number(process.env.DB_PORT || 5432),
  entities: ENTITIES,
  migrations: MIGRATIONS,
  migrationsTableName: "migrations_typeorm",
} as DataSourceOptions);

export default AppDataSource;
