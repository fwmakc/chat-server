import { Module } from "@nestjs/common";
import { EventDeliveryGuard } from "api-server-toolkit/guard";
import { ChatModule } from "../chat/chat.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { SubscriberService } from "./subscriber.service";

// ChatModule exports the services identity enforcement needs (kick,
// membership purge, cache invalidation).
@Module({
  imports: [ChatModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, SubscriberService, EventDeliveryGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
