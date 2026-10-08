import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MessageEntity } from "./message.entity";
import { ChatConfig } from "./chat.config";

/**
 * Retention (MAIL_CLEANUP_* pattern): with CHAT_MESSAGE_RETENTION_DAYS > 0
 * messages older than the window are hard-deleted on a fixed interval.
 * Tombstones (soft-deleted rows) always expire independently — they exist
 * only so offline clients learn about deletions through history/sync, and
 * once every client has synced them they are noise.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
    private readonly chatConfig: ChatConfig,
  ) {}

  onModuleInit() {
    if (this.chatConfig.retentionDays === 0) {
      this.logger.log("Message retention disabled — history kept forever");
    }
    this.timer = setInterval(
      () => void this.run(),
      this.chatConfig.cleanupIntervalMs,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      if (this.chatConfig.retentionDays > 0) {
        const kept = await this.messages
          .createQueryBuilder()
          .delete()
          .where(`created_at < now() - interval '1 day' * :days`, {
            days: this.chatConfig.retentionDays,
          })
          .execute();
        if (kept.affected)
          this.logger.log(
            `retention: purged ${kept.affected} messages older than ${this.chatConfig.retentionDays}d`,
          );
      }
      const tombstones = await this.messages
        .createQueryBuilder()
        .delete()
        .where(
          `deleted_at IS NOT NULL AND deleted_at < now() - interval '1 day' * :days`,
          { days: this.chatConfig.tombstoneDays },
        )
        .execute();
      if (tombstones.affected)
        this.logger.log(
          `retention: purged ${tombstones.affected} tombstones older than ${this.chatConfig.tombstoneDays}d`,
        );
    } catch (e) {
      this.logger.warn(`retention pass failed: ${(e as Error).message}`);
    }
  }
}
