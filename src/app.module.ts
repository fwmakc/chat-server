import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "@src/auth/auth.module";
import { EventBusModule } from "@core/common";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, EventBusModule, ChatModule],
})
export class AppModule {}