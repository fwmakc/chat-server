import { Test } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { AuthClientService } from "api-server-toolkit/auth-client";
import { DataSource, Repository } from "typeorm";
import { ChannelEntity, ChannelMemberEntity } from "../chat/channel.entity";
import { MessageEntity } from "../chat/message.entity";
import { ChatService } from "../chat/chat.service";
import { ChatConfig } from "../chat/chat.config";
import { EmitterService } from "../chat/emitter.service";
import { WsAuthService } from "../chat/ws-auth.service";
import { WebhooksService } from "./webhooks.service";

/**
 * Identity events → realtime enforcement: deactivation/deletion kick the
 * account's sockets, deletion also purges memberships. Handlers are
 * naturally idempotent — at-least-once redelivery is safe without a
 * dedupe ledger.
 */
describe("webhooks → chat enforcement (db)", () => {
  let service: WebhooksService;
  let chat: ChatService;
  let membersRepo: Repository<ChannelMemberEntity>;
  let dataSource: DataSource;
  let disconnectUser: jest.Mock;
  let clearCache: jest.Mock;

  const alice = { id: 11, username: "a@t", isSuperuser: false };
  const bob = { id: 12, username: "b@t", isSuperuser: false };

  const envelope = (pattern: string, payload: object) =>
    ({ pattern, payload }) as never;

  beforeAll(async () => {
    disconnectUser = jest.fn();
    clearCache = jest.fn();
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
      providers: [
        ChatService,
        WebhooksService,
        {
          provide: ChatConfig,
          useValue: new ChatConfig({ get: () => undefined } as never),
        },
        {
          provide: EmitterService,
          useValue: { disconnectUser, toUser: jest.fn(), toChannel: jest.fn() },
        },
        { provide: WsAuthService, useValue: { clearCache } },
        {
          provide: AuthClientService,
          useValue: {
            getAccountInfo: async (id: number) => ({
              id,
              username: `user${id}@t`,
              isActivated: true,
              roles: [],
            }),
            clearCache: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(WebhooksService);
    chat = moduleRef.get(ChatService);
    membersRepo = moduleRef.get(getRepositoryToken(ChannelMemberEntity));
    dataSource = moduleRef.get(DataSource);
  }, 60_000);

  it("user.deactivated kicks sockets and invalidates the cache", async () => {
    await service.handleEvent(
      envelope("user.deactivated", {
        userId: bob.id,
        username: "b@t",
        email: "b@t",
      }),
    );
    expect(disconnectUser).toHaveBeenCalledWith(bob.id);
    expect(clearCache).toHaveBeenCalledWith(bob.id);
  });

  it("user.deleted kicks sockets AND purges every membership", async () => {
    const { channel } = await chat.createChannel(alice, {
      type: "channel",
      title: "doomed",
      isPublic: true,
      members: [bob.id],
    });
    const pair = await chat.createChannel(alice, {
      type: "dm",
      members: [bob.id],
    });
    expect(await chat.memberChannelIds(bob.id)).toHaveLength(2);

    await service.handleEvent(
      envelope("user.deleted", {
        userId: bob.id,
        username: "b@t",
        email: "b@t",
      }),
    );

    expect(disconnectUser).toHaveBeenCalledWith(bob.id);
    expect(await chat.memberChannelIds(bob.id)).toHaveLength(0);
    const rows = await membersRepo.findBy({ accountId: String(bob.id) });
    expect(rows).toHaveLength(0);
    // the channel itself survives with its owner
    expect(await chat.memberChannelIds(alice.id)).toHaveLength(2);
    expect(String(channel.id) + String(pair.channel.id)).toBeDefined();
  });

  it("redelivery of user.deleted is a no-op (idempotent by construction)", async () => {
    disconnectUser.mockClear();
    await service.handleEvent(
      envelope("user.deleted", {
        userId: bob.id,
        username: "b@t",
        email: "b@t",
      }),
    );
    expect(disconnectUser).toHaveBeenCalledWith(bob.id); // harmless re-kick
    expect(await chat.memberChannelIds(bob.id)).toHaveLength(0);
  });

  it("roles_changed only invalidates the cache", async () => {
    clearCache.mockClear();
    await service.handleEvent(
      envelope("user.roles_changed", {
        userId: 13,
        username: "c@t",
        email: "c@t",
        roles: [],
      }),
    );
    expect(clearCache).toHaveBeenCalledWith(13);
  });

  it("unknown patterns warn and return without invalidation", async () => {
    clearCache.mockClear();
    await expect(
      service.handleEvent(envelope("user.registered", { userId: 1 })),
    ).resolves.toBeUndefined();
    expect(clearCache).not.toHaveBeenCalled();
  });

  it("events without a usable userId are ignored safely", async () => {
    disconnectUser.mockClear();
    clearCache.mockClear();
    await expect(
      service.handleEvent(envelope("user.deactivated", {})),
    ).resolves.toBeUndefined();
    expect(disconnectUser).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });
});
