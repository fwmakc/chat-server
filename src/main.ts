import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { bootstrap } from "api-server-toolkit/bootstrap";
import { Sentry, Helmet, Cors, ValidationPipe, Log, Prefix } from "api-server-toolkit/bootstrap/setup";
import { AppModule } from "@src/app.module";

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  Sentry.setup(app);
  Helmet.setup(app);
  Cors.setup(app);
  ValidationPipe.setup(app);
  Log.setup(app);
  Prefix.setup(app);

  app.useWebSocketAdapter(new IoAdapter(app));

  await bootstrap(app, { port: 3004 });
}

main();
