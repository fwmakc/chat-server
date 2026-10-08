import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { bootstrap } from "api-server-toolkit/bootstrap";
import {
  Sentry,
  Helmet,
  Cors,
  ValidationPipe,
  Log,
  Prefix,
  Swagger,
} from "api-server-toolkit/bootstrap/setup";
import { AppModule } from "@src/app.module";

async function main() {
  // Must run before TypeORM initializes: app.module always wraps the
  // DataSource with addTransactionalDataSource, and boot migrations
  // (migrationsRun) touch the patched EntityManager during initialize().
  const { initializeTransactionalContext } =
    await import("typeorm-transactional");
  initializeTransactionalContext();

  // rawBody keeps the exact request bytes for the EventDeliveryGuard
  // (HMAC is verified over the signed string, not the re-serialized body).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  Sentry.setup(app);
  Helmet.setup(app);
  Cors.setup(app);
  ValidationPipe.setup(app);
  Log.setup(app);
  Prefix.setup(app);
  Swagger.setup(app);

  // Redis adapter makes sockets cluster-aware (broadcasts, rooms,
  // disconnectSockets across replicas); without REDIS_URL the in-memory
  // adapter limits the deployment to a single replica.
  if (process.env.REDIS_URL) {
    const { RedisIoAdapter } = await import("./chat/redis-io.adapter");
    app.useWebSocketAdapter(new RedisIoAdapter(app, process.env.REDIS_URL));
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  await bootstrap(app, { port: Number(process.env.PORT) || 3004 });
}

main();
