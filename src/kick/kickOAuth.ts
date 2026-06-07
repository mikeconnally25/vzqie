import { client as KickApiClient, type OAuthAuthorizationParams, type OAuthToken } from "@nekiro/kick-api";
import { lookupKickChannel } from "./kickChannelLookup.js";

export interface KickOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface KickOAuthProfile {
  slug: string;
  kickUserId: number;
  kickChatroomId: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export function getKickOAuthConfig(): KickOAuthConfig | null {
  const clientId = process.env.KICK_CLIENT_ID?.trim();
  const clientSecret = process.env.KICK_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.KICK_REDIRECT_URI?.trim() ??
    `http://localhost:${process.env.PORT ?? 3000}/api/kick/oauth/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function createKickOAuthClient(config = getKickOAuthConfig()) {
  if (!config) {
    throw new Error("Kick OAuth is not configured. Set KICK_CLIENT_ID and KICK_CLIENT_SECRET.");
  }

  return new KickApiClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    debug: process.env.KICK_DEBUG === "1",
  });
}

export function startKickOAuth(state?: string): {
  authUrl: string;
  pkce: OAuthAuthorizationParams;
} {
  const kickClient = createKickOAuthClient();
  const pkce = kickClient.generatePKCEParams();
  const authUrl = kickClient.getAuthorizationUrl(
    {
      ...pkce,
      state,
    },
    ["user:read"]
  );

  return { authUrl, pkce };
}

export async function exchangeKickOAuthCode(
  code: string,
  codeVerifier: string
): Promise<OAuthToken> {
  const kickClient = createKickOAuthClient();
  return kickClient.exchangeCodeForToken({
    code,
    codeVerifier,
  });
}

export async function resolveKickOAuthProfile(
  token: OAuthToken
): Promise<KickOAuthProfile> {
  const kickClient = createKickOAuthClient();
  kickClient.setToken(token);

  const channels = await kickClient.channels.getChannels();
  const channel = channels[0];

  if (!channel?.slug || !channel.user?.id) {
    throw new Error("Kick account linked, but channel details were missing.");
  }

  let chatroomId = channel.id;

  try {
    const resolved = await lookupKickChannel(channel.slug);
    chatroomId = resolved.chatroomId;
  } catch {
    // Fall back to the authenticated channel id when public lookup is blocked.
  }

  return {
    slug: channel.slug,
    kickUserId: channel.user.id,
    kickChatroomId: chatroomId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
  };
}

export function isKickOAuthConfigured(): boolean {
  return getKickOAuthConfig() !== null;
}
