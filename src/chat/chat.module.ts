import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthClientModule } from "api-server-toolkit/auth-client";
import { ChannelEntity, ChannelMemberEntity } from "./channel.entity";
import { MessageEntity } from "./message.entity";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { WsAuthService } from "./ws-auth.service";
import { RateLimitService } from "./rate-limit.service";
import { PresenceService } from "./presence.service";
import { EmitterService } from "./emitter.service";
import { RetentionService } from "./retention.service";
import { ChatConfig } from "./chat.config";
import { ChatMetrics } from "./chat.metrics";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelEntity,
      ChannelMemberEntity,
      MessageEntity,
    ]),
    AuthClientModule.forRoot(),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    WsAuthService,
    RateLimitService,
    PresenceService,
    EmitterService,
    RetentionService,
    ChatConfig,
    ChatMetrics,
  ],
  exports: [ChatService, WsAuthService, EmitterService, ChatConfig],
})
export class ChatModule {}
