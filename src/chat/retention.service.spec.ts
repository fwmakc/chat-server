import { Test } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ChannelEntity, ChannelMemberEntity } from "./channel.entity";
import { MessageEntity } from "./message.entity";
import { RetentionService } from "./retention.service";
import { ChatConfig } from "./chat.config";

const config = (retentionDays: number, tombstoneDays: number) =>
  ({
    retentionDays,
    tombstoneDays,
    cleanupIntervalMs: 3_600_000,
  }) as ChatConfig;

describe("RetentionService (db)", () => {
  let svc: RetentionService;
  let messages: Repository<MessageEntity>;
  let dataSource: DataSource;

  const seed = async (n: number, days: number, deletedDays?: number) => {
    const channel = {
      id: "1",
      type: "channel",
      isPublic: true,
      createdBy: "1",
    } as never;
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(ChannelEntity)
      .values(channel)
      .orIgnore()
      .execute();
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(ChannelMemberEntity)
      .values({ channelId: "1", accountId: "1" })
      .orIgnore()
      .execute();
    const rows = Array.from({ length: n }, (_, i) => ({
      channelId: "1",
      accountId: "1",
      body: `old-${days}-${i}`,
      clientId: `old-${days}-${deletedDays ?? "live"}-${i}`,
      ...(deletedDays !== undefined ? { deletedAt: new Date() } : {}),
    }));
    await messages.insert(rows);
    const age = deletedDays ?? days;
    await messages.query(
      `UPDATE chat_messages SET created_at = now() - interval '1 day' * $1
       WHERE client_id LIKE $2`,
      [days, `old-${days}-%`],
    );
    if (deletedDays !== undefined) {
      await messages.query(
        `UPDATE chat_messages SET deleted_at = now() - interval '1 day' * $1
         WHERE client_id LIKE $2`,
        [deletedDays, `old-${days}-%`],
      );
    }
  };

  const countLike = async (pattern: string) =>
    Number(
      (
        await messages.query(
          "SELECT count(*)::int AS n FROM chat_messages WHERE client_id LIKE $1",
          [pattern],
        )
      )[0].n,
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: Number(process.env.DB_PORT || 5432),
          username: process.env.DB_USER || "root",
          password: process.env.DB_PASSWORD || "1234",
          database: process.env.DB_NAME || "chat_server_test",
          entities: [ChannelEntity, ChannelMemberEntity, MessageEntity],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          ChannelEntity,
          ChannelMemberEntity,
          MessageEntity,
        ]),
      ],
      providers: [],
    }).compile();
    svc = new RetentionService(
      moduleRef.get(getRepositoryToken(MessageEntity)),
      config(0, 7),
    );
    messages = moduleRef.get(getRepositoryToken(MessageEntity));
    dataSource = moduleRef.get(DataSource);
  }, 60_000);

  it("retentionDays=0 keeps history forever", async () => {
    await seed(3, 30);
    await svc.run();
    expect(await countLike("old-30-%")).toBe(3);
  });

  it("messages older than the window are hard-deleted", async () => {
    await seed(3, 10);
    const svc2 = new RetentionService(messages, config(14, 7));
    await svc2.run();
    expect(await countLike("old-10-%")).toBe(3); // 10d < 14d → kept
    const svc3 = new RetentionService(messages, config(5, 7));
    await svc3.run();
    expect(await countLike("old-10-%")).toBe(0); // 10d > 5d → gone
  });

  it("tombstones expire on their own TTL, live rows survive", async () => {
    await seed(2, 0, 30); // deleted 30 days ago, created now
    await new RetentionService(messages, config(0, 7)).run();
    expect(await countLike("old-0-%")).toBe(0); // old tombstones gone
    await seed(2, 0, 1); // freshly deleted
    await new RetentionService(messages, config(0, 7)).run();
    expect(await countLike("old-0-%")).toBe(2); // still syncing window
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });
});
