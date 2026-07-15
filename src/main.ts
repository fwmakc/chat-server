import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "@src/app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { origin: true, credentials: true },
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3004;
  const ip = process.env.IP || "localhost";

  await app.listen(port, ip).then(() => {
    console.log(`Chat server running on ${port} port at http://${ip}:${port}`);
  });

  process.on("SIGINT", () => {
    app.close();
  });
}

bootstrap();
