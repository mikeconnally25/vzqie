import type { Request, RequestHandler } from "express";
import type { PublicUser } from "./types.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    viewerId?: string;
    kickOAuthCodeVerifier?: string;
    kickOAuthState?: string;
    pendingKickLink?: {
      slug: string;
      kickUserId: number;
      kickChatroomId: number;
      accessToken: string;
      refreshToken?: string;
      expiresAt: number;
    };
  }
}

export interface AuthedRequest extends Request {
  user?: PublicUser;
}

export function createRequireAuth(authService: {
  getUserById(id: string): Promise<PublicUser | null>;
}): RequestHandler {
  return async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Sign in required." });
      return;
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      req.session.userId = undefined;
      res.status(401).json({ ok: false, error: "Sign in required." });
      return;
    }

    (req as AuthedRequest).user = user;
    next();
  };
}
