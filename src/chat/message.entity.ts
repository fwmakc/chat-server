import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export interface MessageAttachment {
  key: string;
  url: string;
  mime?: string;
  size?: number;
  name?: string;
}

/**
 * A chat message. Soft delete leaves a tombstone (deleted_at) so offline
 * clients learn about deletions through history/sync instead of ghost
 * rows. `client_id` makes message:send idempotent — a retry with the same
 * (channel, author, client_id) returns the original row, never a duplicate.
 */
@Entity("chat_messages")
@Index("uq_chat_messages_client", ["channelId", "accountId", "clientId"], {
  unique: true,
})
@Index("idx_chat_messages_channel_id", ["channelId", "id"])
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ name: "channel_id", type: "bigint" })
  channelId: string;

  @Column({ name: "account_id", type: "bigint" })
  accountId: string;

  // Length is validated at the app layer (CHAT_MESSAGE_MAX_LEN).
  @Column({ name: "body", type: "text" })
  body: string;

  @Column({ name: "attachments", type: "jsonb", nullable: true })
  attachments: MessageAttachment[] | null;

  @Column({ name: "client_id", type: "varchar", length: 64 })
  clientId: string;

  @Column({ name: "edited_at", type: "timestamptz", nullable: true })
  editedAt: Date | null;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
