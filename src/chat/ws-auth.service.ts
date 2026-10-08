import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthClientService } from "api-server-toolkit/auth-client";
import * as jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";

/** Hydrated identity attached to every authenticated socket. */
export interface ChatAccount {
  id: number;
  username: string;
  roles: string[];
  isSuperuser: boolean;
  /** Access-token expiry (epoch ms) — sessions die with their token. */
  tokenExp: number;
}

/**
 * Verifies an access token against auth-server's JWKS and hydrates the
 * account via the toolkit auth-client (LRU-cached roles). This is the WS
 * analogue of the toolkit's HTTP passport strategy: same issuer/audience
 * envs, same `type === "access"` enforcement (mfa challenge tokens are
 * rejected), same role source (internal account info, not the token).
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);
  private readonly jwks: jwksClient.JwksClient;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly authClient: AuthClientService,
  ) {
    const baseUrl = this.config.get<string>(
      "AUTH_SERVER_URL",
      "http://localhost:3001",
    );
    this.jwks = jwksClient({
      jwksUri: `${baseUrl}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    this.issuer = this.config.get<string>("JWT_ISSUER") || undefined;
    this.audience = this.config.get<string>("JWT_AUDIENCE") || undefined;
  }

  /** Throws on any failure; returns the hydrated chat account. */
  async authenticate(token: string): Promise<ChatAccount> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      throw new Error("malformed token");
    }

    const key = await this.jwks.getSigningKey(decoded.header.kid);
    const payload = jwt.verify(token, key.getPublicKey(), {
      algorithms: ["RS256"],
      ...(this.issuer ? { issuer: this.issuer } : {}),
      ...(this.audience ? { audience: this.audience } : {}),
    }) as jwt.JwtPayload;

    // The toolkit HTTP strategy enforces the same claim: only real access
    // tokens open routes — mfa challenge tokens never do.
    if (payload.type !== "access") {
      throw new Error(`token type "${payload.type}" is not an access token`);
    }

    const accountId = Number(payload.id);
    if (!accountId) throw new Error("token has no account id");

    const info = await this.authClient.getAccountInfo(accountId);
    if (!info) throw new Error("account lookup failed");
    if (info.isActivated === false) throw new Error("account is deactivated");

    return {
      id: accountId,
      username: info.username ?? String(accountId),
      roles: info.roles ?? [],
      isSuperuser: info.isSuperuser === true,
      tokenExp: (Number(payload.exp) || 0) * 1000,
    };
  }

  /** Cache invalidation hook shared with the webhook handlers. */
  clearCache(accountId?: number) {
    this.authClient.clearCache(accountId);
  }
}
