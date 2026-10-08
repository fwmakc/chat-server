import { PresenceService } from "./presence.service";
import { EmitterService } from "./emitter.service";

/**
 * The redis-less profile: presence keys are replica-local (single-replica
 * boots, tests). Transitions 0→1 and 1→0 must broadcast exactly once into
 * the member channels; repeat connects must not duplicate them.
 */
describe("PresenceService (no redis)", () => {
  let svc: PresenceService;
  let toChannel: jest.Mock;

  beforeEach(() => {
    toChannel = jest.fn();
    const config = { get: () => undefined };
    svc = new PresenceService(
      config as never,
      { toChannel } as unknown as EmitterService,
    );
  });

  afterEach(() => {
    svc.onModuleDestroy();
  });

  it("first connect broadcasts online into every member channel", async () => {
    await svc.connect(11, [1, 2]);
    expect(toChannel).toHaveBeenCalledTimes(2);
    expect(toChannel).toHaveBeenCalledWith(1, "presence.updated", {
      accountId: 11,
      status: "online",
    });
  });

  it("a second concurrent connection does not re-broadcast", async () => {
    await svc.connect(11, [1]);
    toChannel.mockClear();
    await svc.connect(11, [1]);
    expect(toChannel).not.toHaveBeenCalled();
  });

  it("the last disconnect broadcasts offline; intermediate ones stay silent", async () => {
    await svc.connect(11, [7]);
    await svc.connect(11, [7]);
    toChannel.mockClear();
    await svc.disconnect(11, [7]);
    expect(toChannel).not.toHaveBeenCalled();
    await svc.disconnect(11, [7]);
    expect(toChannel).toHaveBeenCalledTimes(1);
    expect(toChannel).toHaveBeenCalledWith(7, "presence.updated", {
      accountId: 11,
      status: "offline",
    });
  });

  it("status is unknown without redis", async () => {
    expect(await svc.status(11)).toBeUndefined();
  });

  it("over-disconnect is tolerated (crash-prone clients)", async () => {
    await expect(svc.disconnect(404, [])).resolves.toBeUndefined();
    await expect(svc.disconnect(404, [])).resolves.toBeUndefined();
  });
});
