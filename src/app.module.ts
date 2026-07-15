import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventBusModule } from "@src/event-bus/event-bus.module";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [ConfigModule.forRoot(), EventBusModule, ChatModule],
})
export class AppModule {}
