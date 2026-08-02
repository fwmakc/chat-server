import { bootstrap } from "api-server-toolkit/bootstrap";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "@src/app.module";

bootstrap({
  module: AppModule,
  serviceName: "chat-server",
  swagger: false,
  cors: { origin: true, credentials: true },
  beforeListen: (app) => {
    app.useWebSocketAdapter(new IoAdapter(app));
  },
});
