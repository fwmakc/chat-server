import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { WsAuthService } from "./ws-auth.service";

// WsAuthService does `jwksClient({...})` on the required module — the mock
// module must BE a function returning the stub client. getSigningKey is
// attached so tests can drive per-kid responses.
jest.mock("jwks-rsa", () => {
  const getSigningKey = jest.fn();
  const client = { getSigningKey };
  return Object.assign(() => client, { getSigningKey });
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwksMock = require("jwks-rsa") as {
  getSigningKey: jest.Mock;
};

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicKeyPem = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

const KID = "test-kid";
const sign = (
  payload: Record<string, unknown>,
  opts: jwt.SignOptions = {},
  key = privateKey,
) =>
  jwt.sign(payload, key, {
    algorithm: "RS256",
    keyid: KID,
    expiresIn: "1h",
    ...opts,
  });

const config = (env: Record<string, string>) =>
  ({ get: (k: string, d?: string) => env[k] ?? d }) as never;

const authClient = {
  getAccountInfo: jest.fn(async (id: number) => ({
    id,
    username: `u${id}@t`,
    isActivated: true,
    roles: ["authenticated"],
    isSuperuser: id === 1,
  })),
  clearCache: jest.fn(),
};

describe("WsAuthService (handshake auth)", () => {
  let svc: WsAuthService;

  beforeAll(() => {
    jwksMock.getSigningKey.mockImplementation(async (kid: string) => {
      if (kid !== KID) throw new Error(`unknown kid: ${kid}`);
      return { getPublicKey: () => publicKeyPem };
    });
    svc = new WsAuthService(config({}), authClient as never);
  });

  beforeEach(() => authClient.getAccountInfo.mockClear());

  it("a valid access token hydrates into a chat account", async () => {
    const token = sign({ id: 7, type: "access" }, { expiresIn: 3600 });
    const account = await svc.authenticate(token);
    expect(account).toMatchObject({
      id: 7,
      username: "u7@t",
      roles: ["authenticated"],
      isSuperuser: false,
    });
    // tokenExp mirrors the access-token exp (≈ now + 1h), in ms
    expect(account.tokenExp).toBeGreaterThan(Date.now() + 3_500_000);
    expect(account.tokenExp).toBeLessThan(Date.now() + 3_700_000);
  });

  it("mfa challenge tokens are rejected", async () => {
    await expect(
      svc.authenticate(sign({ id: 7, type: "mfa" })),
    ).rejects.toThrow(/not an access token/);
  });

  it("refresh-style tokens (no type claim) are rejected", async () => {
    await expect(svc.authenticate(sign({ id: 7 }))).rejects.toThrow();
  });

  it("expired tokens are rejected by verification", async () => {
    await expect(
      svc.authenticate(sign({ id: 7, type: "access" }, { expiresIn: "-1h" })),
    ).rejects.toThrow();
  });

  it("signatures from another key are rejected", async () => {
    const stranger = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    await expect(
      svc.authenticate(
        sign({ id: 7, type: "access" }, {}, stranger.privateKey),
      ),
    ).rejects.toThrow();
  });

  it("unknown kids are rejected without leaking a default key", async () => {
    await expect(
      svc.authenticate(sign({ id: 7, type: "access" }, { keyid: "evil" })),
    ).rejects.toThrow();
  });

  it("deactivated accounts and unknown accounts are rejected", async () => {
    authClient.getAccountInfo.mockResolvedValueOnce({
      id: 7,
      username: "u7@t",
      isActivated: false,
      roles: [],
      isSuperuser: false,
    });
    await expect(
      svc.authenticate(sign({ id: 7, type: "access" })),
    ).rejects.toThrow(/deactivated/);
    authClient.getAccountInfo.mockResolvedValueOnce(null);
    await expect(
      svc.authenticate(sign({ id: 8, type: "access" })),
    ).rejects.toThrow(/lookup failed/);
  });

  it("malformed tokens are rejected", async () => {
    await expect(svc.authenticate("garbage")).rejects.toThrow(/malformed/);
  });

  it("issuer/audience are enforced when configured", async () => {
    const strict = new WsAuthService(
      config({ JWT_ISSUER: "auth.example", JWT_AUDIENCE: "chat" }),
      authClient as never,
    );
    await expect(
      strict.authenticate(sign({ id: 7, type: "access" })),
    ).rejects.toThrow();
    const ok = await strict.authenticate(
      sign(
        { id: 7, type: "access" },
        { issuer: "auth.example", audience: "chat" },
      ),
    );
    expect(ok.id).toBe(7);
  });

  it("clearCache delegates to the auth client", () => {
    svc.clearCache(7);
    expect(authClient.clearCache).toHaveBeenCalledWith(7);
    svc.clearCache();
    expect(authClient.clearCache).toHaveBeenCalledWith(undefined);
  });
});
