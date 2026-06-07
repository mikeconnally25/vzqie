import express from "express";
import session from "express-session";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./src/loadEnv.js";
import { AuthService } from "./src/auth/authService.js";
import { createRequireAuth } from "./src/auth/session.js";
import { ViewerService } from "./src/auth/viewerService.js";
import { lookupKickChannel } from "./src/kick/kickChannelLookup.js";
import {
  exchangeKickOAuthCode,
  isKickOAuthConfigured,
  resolveKickOAuthProfile,
  startKickOAuth,
} from "./src/kick/kickOAuth.js";
import { GiveawayService, loadGiveawayConfig } from "./src/app/giveawayService.js";

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const sessionSecret =
  process.env.SESSION_SECRET ?? "dev-secret-change-me-in-production";

if (
  process.env.NODE_ENV === "production" &&
  sessionSecret === "dev-secret-change-me-in-production"
) {
  throw new Error("Set SESSION_SECRET before running in production.");
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

const authService = new AuthService();
const viewerService = new ViewerService();
const service = new GiveawayService(loadGiveawayConfig());
const requireAdmin = createRequireAuth(authService);

service.onEvent((event) => {
  io.emit(event.type, event.payload);
});

app.get("/api/auth/setup", async (_req, res) => {
  const adminCount = await authService.countUsers();
  res.json({ needsSetup: adminCount === 0 });
});

app.get("/api/auth/me", async (req, res) => {
  let user = null;
  let viewer = null;
  const adminCount = await authService.countUsers();

  if (req.session.userId) {
    user = await authService.getUserById(req.session.userId);
    if (!user) {
      req.session.userId = undefined;
    }
  }

  if (req.session.viewerId) {
    viewer = await viewerService.getViewerById(req.session.viewerId);
    if (!viewer) {
      req.session.viewerId = undefined;
    }
  }

  res.json({
    user,
    viewer,
    needsSetup: adminCount === 0,
    kickOAuthConfigured: isKickOAuthConfigured(),
    pendingKickLink: req.session.pendingKickLink
      ? {
          slug: req.session.pendingKickLink.slug,
          kickUserId: req.session.pendingKickLink.kickUserId,
          kickChatroomId: req.session.pendingKickLink.kickChatroomId,
        }
      : null,
  });
});

app.get("/api/kick/lookup", async (req, res) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug.trim()) {
    res.status(400).json({ ok: false, error: "Kick username is required." });
    return;
  }

  try {
    const channel = await lookupKickChannel(slug);
    res.json({ ok: true, channel });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function handleKickOAuthCallback(
  req: express.Request,
  res: express.Response
): Promise<void> {
  if (!isKickOAuthConfigured()) {
    res.status(503).send("Kick OAuth is not configured.");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const codeVerifier = req.session.kickOAuthCodeVerifier;

  if (!code || !codeVerifier) {
    res.redirect("/?kick_oauth=failed");
    return;
  }

  try {
    const token = await exchangeKickOAuthCode(code, codeVerifier);
    const profile = await resolveKickOAuthProfile(token);

    req.session.pendingKickLink = {
      slug: profile.slug,
      kickUserId: profile.kickUserId,
      kickChatroomId: profile.kickChatroomId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      expiresAt: profile.expiresAt,
    };
    delete req.session.kickOAuthCodeVerifier;
    delete req.session.kickOAuthState;

    res.redirect("/?kick_oauth=linked");
  } catch (error) {
    console.error("Kick OAuth callback failed:", error);
    res.redirect("/?kick_oauth=failed");
  }
}

app.get("/api/kick/oauth/url", (req, res) => {
  if (!isKickOAuthConfigured()) {
    res.status(503).json({ ok: false, error: "Kick OAuth is not configured." });
    return;
  }

  const { authUrl, pkce } = startKickOAuth(randomUUID());
  req.session.kickOAuthCodeVerifier = pkce.codeVerifier;
  req.session.kickOAuthState = pkce.state;

  res.json({ ok: true, authUrl });
});

app.get("/api/kick/oauth/start", (req, res) => {
  if (!isKickOAuthConfigured()) {
    res.status(503).send("Kick OAuth is not configured.");
    return;
  }

  const { authUrl, pkce } = startKickOAuth(randomUUID());
  req.session.kickOAuthCodeVerifier = pkce.codeVerifier;
  req.session.kickOAuthState = pkce.state;

  res.redirect(authUrl);
});

app.get("/api/kick/oauth/callback", handleKickOAuthCallback);
app.get("/api/callback", handleKickOAuthCallback);

app.post("/api/auth/signup", async (req, res) => {
  try {
    const adminCount = await authService.countUsers();
    if (adminCount > 0) {
      res.status(403).json({
        ok: false,
        error: "Streamer account already exists. Sign in instead.",
      });
      return;
    }

    const username =
      typeof req.body?.username === "string" ? req.body.username : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const email =
      typeof req.body?.email === "string" ? req.body.email : undefined;

    const user = await authService.signup({
      username,
      password,
      email,
    });
    req.session.userId = user.id;
    req.session.viewerId = undefined;

    res.status(201).json({ ok: true, user });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username =
      typeof req.body?.username === "string" ? req.body.username : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    const user = await authService.login({ username, password });
    req.session.userId = user.id;
    req.session.viewerId = undefined;

    res.json({ ok: true, user });
  } catch (error) {
    res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/viewers/signup", async (req, res) => {
  try {
    const pending = req.session.pendingKickLink;
    const kickUsername =
      pending?.slug ??
      (typeof req.body?.kickUsername === "string" ? req.body.kickUsername : "");
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const email =
      typeof req.body?.email === "string" ? req.body.email : undefined;
    const kickChatroomIdRaw = req.body?.kickChatroomId;
    const kickChatroomId =
      pending?.kickChatroomId ??
      (kickChatroomIdRaw === undefined || kickChatroomIdRaw === ""
        ? undefined
        : Number(kickChatroomIdRaw));

    const viewer = await viewerService.signup({
      kickUsername,
      password,
      email,
      kickChatroomId: Number.isFinite(kickChatroomId) ? kickChatroomId : undefined,
      kickUserId: pending?.kickUserId,
      kickAccessToken: pending?.accessToken,
      kickRefreshToken: pending?.refreshToken,
      kickTokenExpiresAt: pending
        ? new Date(pending.expiresAt).toISOString()
        : undefined,
    });
    req.session.viewerId = viewer.id;
    req.session.userId = undefined;
    delete req.session.pendingKickLink;
    await service.loadRegisteredViewers();

    res.status(201).json({ ok: true, viewer });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/viewers/login", async (req, res) => {
  try {
    const kickUsername =
      typeof req.body?.kickUsername === "string" ? req.body.kickUsername : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    const viewer = await viewerService.login({ kickUsername, password });
    req.session.viewerId = viewer.id;
    req.session.userId = undefined;

    res.json({ ok: true, viewer });
  } catch (error) {
    res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ ok: false, error: "Could not sign out." });
      return;
    }

    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/state", (_req, res) => {
  res.json(service.getState());
});

app.post("/api/draw", requireAdmin, (req, res) => {
  const count = Number(req.body?.count ?? 1);
  const winners = service.draw(Number.isFinite(count) ? count : 1);
  res.json({ winners, state: service.getState() });
});

app.post("/api/refresh", requireAdmin, (_req, res) => {
  service.refresh();
  res.json({ ok: true, state: service.getState() });
});

app.patch("/api/settings/keyword", requireAdmin, (req, res) => {
  try {
    const keyword =
      typeof req.body?.keyword === "string" ? req.body.keyword : undefined;
    const enabled =
      typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;

    if (keyword === undefined && enabled === undefined) {
      res.status(400).json({ ok: false, error: "No settings provided." });
      return;
    }

    const state = service.getState();
    service.setKeywordSettings(
      keyword ?? state.entryKeyword,
      enabled ?? state.keywordEnabled
    );

    res.json({ ok: true, state: service.getState() });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

io.on("connection", (socket) => {
  socket.emit("state", service.getState());
});

async function main(): Promise<void> {
  httpServer.listen(port, () => {
    console.log(`Dashboard: http://localhost:${port}`);
  });

  try {
    await service.start();
    const state = service.getState();
    console.log(`Channel: #${state.channel}`);
    if (process.env.KICK_CHATROOM_ID) {
      console.log(`Chatroom ID: ${process.env.KICK_CHATROOM_ID}`);
    }
    console.log(`Registered viewers: ${state.registeredViewers}`);
    console.log(
      `Entry keyword: ${state.keywordEnabled ? state.entryKeyword : "off (all chat counts)"}`
    );
    if (!state.chatConnected) {
      console.warn("Kick chat is offline — check .env and restart.");
    }
  } catch (error) {
    console.error("Kick chat connection failed:", error);
    console.error("The dashboard is running, but live chat is offline.");
  }

  const adminCount = await authService.countUsers();
  if (adminCount === 0) {
    console.warn("No streamer account yet — create one from the dashboard.");
  }
}

process.on("SIGINT", async () => {
  await service.stop();
  process.exit(0);
});

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
