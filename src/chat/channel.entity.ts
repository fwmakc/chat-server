import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type ChannelType = "channel" | "dm";
export type MemberRole = "owner" | "moderator" | "member";

/** "min:max" of the two account ids — makes a DM pair idempotent. */
export const dmKeyFor = (a: number | string, b: number | string): string => {
  const [x, y] = [Number(a), Number(b)].sort((m, n) => m - n);
  return `${x}:${y}`;
};

/**
 * A conversation. `channel` is a named group (public ones are joinable by
 * any authenticated account); `dm` is a private two-member pair pinned by
 * the unique `dm_key`. Direct TypeORM decorators (not the toolkit column
 * set): key columns must be NOT NULL and indexes explicitly named so the
 * migration and the entity agree byte-for-byte (file-server pattern).
 */
@Entity("chat_channels")
@Index("uq_chat_channels_dm_key", ["dmKey"], { unique: true })
export class ChannelEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({
    name: "type",
    type: "enum",
    enum: ["channel", "dm"],
    enumName: "chat_channel_type",
    default: "channel",
  })
  type: ChannelType;

  // Only meaningful for type=channel; DMs are always private.
  @Column({ name: "is_public", type: "boolean", default: false })
  isPublic: boolean;

  @Column({ name: "title", type: "varchar", length: 255, nullable: true })
  title: string | null;

  @Column({ name: "dm_key", type: "varchar", length: 80, nullable: true })
  dmKey: string | null;

  @Column({ name: "created_by", type: "bigint" })
  createdBy: string;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}

@Entity("chat_channel_members")
@Index("uq_chat_channel_members_pair", ["channelId", "accountId"], {
  unique: true,
})
@Index("idx_chat_channel_members_account", ["accountId"])
export class ChannelMemberEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ name: "channel_id", type: "bigint" })
  channelId: string;

  @Column({ name: "account_id", type: "bigint" })
  accountId: string;

  @Column({
    name: "role",
    type: "enum",
    enum: ["owner", "moderator", "member"],
    enumName: "chat_member_role",
    default: "member",
  })
  role: MemberRole;

  // Unread cursor: messages with id > lastReadMessageId are unread.
  @Column({ name: "last_read_message_id", type: "bigint", default: 0 })
  lastReadMessageId: string;

  @CreateDateColumn({ name: "joined_at", type: "timestamptz" })
  joinedAt: Date;
}
