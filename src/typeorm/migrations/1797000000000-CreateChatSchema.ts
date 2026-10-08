import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * First schema for chat-server: channels (group + DM pairs), membership
 * with per-member read cursors, and messages (idempotent client_id,
 * soft-delete tombstones). Enum types are named explicitly so the
 * migration and `synchronize` (test DBs) agree.
 */
export class CreateChatSchema1797000000000 implements MigrationInterface {
  name = "CreateChatSchema1797000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "chat_channel_type" AS ENUM ('channel', 'dm')`,
    );
    await queryRunner.query(
      `CREATE TYPE "chat_member_role" AS ENUM ('owner', 'moderator', 'member')`,
    );
    await queryRunner.query(`CREATE TABLE "chat_channels" (
            "id" BIGSERIAL NOT NULL,
            "type" "chat_channel_type" NOT NULL DEFAULT 'channel',
            "is_public" boolean NOT NULL DEFAULT false,
            "title" varchar(255),
            "dm_key" varchar(80),
            "created_by" BIGINT NOT NULL,
            "deleted_at" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_chat_channels_id" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_chat_channels_dm_key" ON "chat_channels" ("dm_key")`,
    );
    await queryRunner.query(`CREATE TABLE "chat_channel_members" (
            "id" BIGSERIAL NOT NULL,
            "channel_id" BIGINT NOT NULL,
            "account_id" BIGINT NOT NULL,
            "role" "chat_member_role" NOT NULL DEFAULT 'member',
            "last_read_message_id" BIGINT NOT NULL DEFAULT 0,
            "joined_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_chat_channel_members_id" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_chat_channel_members_pair" ON "chat_channel_members" ("channel_id", "account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_channel_members_account" ON "chat_channel_members" ("account_id")`,
    );
    await queryRunner.query(`CREATE TABLE "chat_messages" (
            "id" BIGSERIAL NOT NULL,
            "channel_id" BIGINT NOT NULL,
            "account_id" BIGINT NOT NULL,
            "body" text NOT NULL,
            "attachments" jsonb,
            "client_id" varchar(64) NOT NULL,
            "edited_at" timestamptz,
            "deleted_at" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_chat_messages_client" ON "chat_messages" ("channel_id", "account_id", "client_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_messages_channel_id" ON "chat_messages" ("channel_id", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_messages_channel_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_chat_messages_client"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_channel_members_account"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_chat_channel_members_pair"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_channel_members"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_chat_channels_dm_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_channels"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "chat_member_role"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "chat_channel_type"`);
  }
}
