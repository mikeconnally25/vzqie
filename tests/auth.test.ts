import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { AuthService } from "../src/auth/authService.js";
import { UserStore } from "../src/auth/userStore.js";
import {
  normalizeKickSlug,
  validateChatroomId,
  validateKickSlug,
} from "../src/kick/kickChannelLookup.js";

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

  it("creates a new account with a linked Kick channel", async () => {
    const user = await auth.signup({
      username: "streamer1",
      password: "password123",
      email: "streamer1@example.com",
      kickUsername: "blakjac21",
      kickChatroomId: 282833,
    });

    assert.equal(user.username, "streamer1");
    assert.equal(user.kickUsername, "blakjac21");
    assert.equal(user.kickChatroomId, 282833);
  });

  it("rejects duplicate usernames", async () => {
    await assert.rejects(
      () =>
        auth.signup({
          username: "streamer1",
          password: "anotherpass",
          kickUsername: "otherkick",
          kickChatroomId: 999999,
        }),
      /already taken/
    );
  });

  it("rejects duplicate linked Kick accounts", async () => {
    await assert.rejects(
      () =>
        auth.signup({
          username: "streamer2",
          password: "password123",
          kickUsername: "blakjac21",
          kickChatroomId: 282833,
        }),
      /Kick account is already linked/
    );
  });

  it("logs in with valid credentials", async () => {
    const user = await auth.login({
      username: "streamer1",
      password: "password123",
    });

    assert.equal(user.username, "streamer1");
    assert.equal(user.kickUsername, "blakjac21");
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
