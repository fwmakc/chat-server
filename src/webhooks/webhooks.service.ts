import { Injectable, Logger } from "@nestjs/common";
import { WebhookEnvelopeDto } from "event-server/contracts";
import { WsAuthService } from "../chat/ws-auth.service";
import { EmitterService } from "../chat/emitter.service";
import { ChatService } from "../chat/chat.service";

/**
 * Identity events → realtime enforcement. Deactivation/deletion kick the
 * account's sockets cluster-wide (the Redis adapter routes the room
 * operation to every replica); every delivery invalidates the auth-client
 * cache so roles/superuser stay fresh.
 *
 * All handlers are naturally idempotent (disconnect + cache purge +
 * DELETE-where), so event-server's at-least-once redelivery is safe
 * without a dedupe ledger.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly emitter: EmitterService,
    private readonly chat: ChatService,
  ) {}

  async handleEvent(body: WebhookEnvelopeDto): Promise<void> {
    const userId = Number(body.payload?.userId);
    switch (body.pattern) {
      case "user.deactivated":
        if (userId) {
          this.emitter.disconnectUser(userId);
          this.logger.log(`user.deactivated: kicked sockets of ${userId}`);
        }
        break;
      case "user.deleted":
        if (userId) {
          this.emitter.disconnectUser(userId);
          await this.chat.purgeMemberships(userId);
          this.logger.log(
            `user.deleted: kicked sockets of ${userId}, purged memberships`,
          );
        }
        break;
      case "user.roles_changed":
        // Roles feed superuser checks; the next handshake re-hydrates.
        break;
      default:
        this.logger.warn(`unknown pattern: ${body.pattern}`);
        return;
    }
    this.wsAuth.clearCache(userId || undefined);
  }
}
