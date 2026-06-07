import {
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./password.js";
import {
  kickAccountsMatch,
  lookupKickChannel,
  normalizeKickSlug,
  validateChatroomId,
  validateKickSlug,
} from "../kick/kickChannelLookup.js";
import { UserStore } from "./userStore.js";
import type { LoginInput, PublicUser, SignupInput } from "./types.js";
import { toPublicUser } from "./types.js";

export class AuthService {
  constructor(private readonly store = new UserStore()) {}

  async signup(input: SignupInput): Promise<PublicUser> {
    const usernameError = validateUsername(input.username);
    if (usernameError) {
      throw new Error(usernameError);
    }

    const passwordError = validatePassword(input.password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const emailError = validateEmail(input.email);
    if (emailError) {
      throw new Error(emailError);
    }

    const kickSlugError = validateKickSlug(input.kickUsername);
    if (kickSlugError) {
      throw new Error(kickSlugError);
    }

    const chatroomError = validateChatroomId(input.kickChatroomId);
    if (chatroomError) {
      throw new Error(chatroomError);
    }

    let resolvedKick;
    try {
      resolvedKick = await lookupKickChannel(input.kickUsername);
    } catch {
      resolvedKick = undefined;
    }

    if (
      resolvedKick &&
      !kickAccountsMatch(input.kickUsername, input.kickChatroomId, resolvedKick)
    ) {
      throw new Error(
        "Kick username and chatroom ID do not match. Use the values from your Kick channel page."
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.store.createUser(
      {
        ...input,
        kickUsername: normalizeKickSlug(input.kickUsername),
        kickChatroomId: Number(input.kickChatroomId),
      },
      passwordHash
    );
    return toPublicUser(user);
  }

  async login(input: LoginInput): Promise<PublicUser> {
    const user = await this.store.findByUsername(input.username);
    if (!user) {
      throw new Error("Invalid username or password.");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid username or password.");
    }

    return toPublicUser(user);
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const user = await this.store.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async countUsers(): Promise<number> {
    return this.store.count();
  }
}
