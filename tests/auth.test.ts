import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { AuthService } from "../src/auth/authService.js";
import { UserStore } from "../src/auth/userStore.js";
import { ViewerService } from "../src/auth/viewerService.js";
import { ViewerStore } from "../src/auth/viewerStore.js";
import {
  normalizeKickSlug,
  validateChatroomId,
  validateKickSlug,
} from "../src/kick/kickChannelLookup.js";

const mockKickLookup = async (slug: string) => ({
  slug: normalizeKickSlug(slug),
  chatroomId: 282833,
});

describe("Kick account validation", () => {
  it("accepts valid kick slugs", () => {
    assert.equal(validateKickSlug("blakjac21"), null);
    assert.equal(normalizeKickSlug("@Blakjac21"), "blakjac21");
  });

  it("rejects invalid chatroom ids", () => {
    assert.match(validateChatroomId("abc") ?? "", /valid Kick chatroom ID/);
  });
});

describe("AuthService", () => {
  let tempDir = "";
  let auth: AuthService;

  before(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "giveaway-auth-"));
    auth = new AuthService(new UserStore(tempDir));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a new account", async () => {
    const user = await auth.signup({
      username: "streamer1",
      password: "password123",
      email: "streamer1@example.com",
    });

    assert.equal(user.username, "streamer1");
    assert.equal(user.email, "streamer1@example.com");
  });

  it("rejects duplicate usernames", async () => {
    await assert.rejects(
      () =>
        auth.signup({
          username: "streamer1",
          password: "anotherpass",
        }),
      /already taken/
    );
  });

  it("logs in with valid credentials", async () => {
    const user = await auth.login({
      username: "streamer1",
      password: "password123",
    });

    assert.equal(user.username, "streamer1");
  });

  it("rejects invalid passwords", async () => {
    await assert.rejects(
      () =>
        auth.login({
          username: "streamer1",
          password: "wrong-password",
        }),
      /Invalid username or password/
    );
  });
});

describe("ViewerService", () => {
  let tempDir = "";
  let viewers: ViewerService;

  before(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "giveaway-viewers-"));
    viewers = new ViewerService(new ViewerStore(tempDir), mockKickLookup);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a viewer account linked to Kick", async () => {
    const viewer = await viewers.signup({
      kickUsername: "viewer_one",
      password: "password123",
      email: "viewer@example.com",
    });

    assert.equal(viewer.kickUsername, "viewer_one");
    assert.equal(viewer.kickChatroomId, 282833);
  });

  it("creates a viewer account with OAuth credentials", async () => {
    const viewer = await viewers.signup({
      kickUsername: "oauth_viewer",
      password: "password123",
      kickChatroomId: 424242,
      kickUserId: 777,
      kickAccessToken: "access-token",
      kickRefreshToken: "refresh-token",
      kickTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    assert.equal(viewer.kickUsername, "oauth_viewer");
    assert.equal(viewer.kickChatroomId, 424242);
  });

  it("rejects duplicate Kick accounts", async () => {
    await assert.rejects(
      () =>
        viewers.signup({
          kickUsername: "viewer_one",
          password: "anotherpass",
        }),
      /Kick account is already registered/
    );
  });

  it("logs in with Kick credentials", async () => {
    const viewer = await viewers.login({
      kickUsername: "viewer_one",
      password: "password123",
    });

    assert.equal(viewer.kickUsername, "viewer_one");
  });

  it("rejects invalid viewer passwords", async () => {
    await assert.rejects(
      () =>
        viewers.login({
          kickUsername: "viewer_one",
          password: "wrong-password",
        }),
      /Invalid Kick username or password/
    );
  });
});
