import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import * as Sentry from "@sentry/nestjs";
import helmet from "helmet";
import { AppModule } from "@src/app.module";

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV || "localhost",
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { origin: true, credentials: true },
    logger: ["error", "warn", "log"],
  });

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3004;
  const ip = process.env.IP || "localhost";
  const logger = new Logger("Bootstrap");

  await app.listen(port, ip);
  logger.log(
    `Chat server running on port ${port} at http://${ip}:${port}`,
  );

  process.on("SIGINT", () => {
    app.close();
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start chat server:", err);
  process.exit(1);
});
