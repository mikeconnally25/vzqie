import {
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./password.js";
import {
  lookupKickChannel,
  normalizeKickSlug,
  validateKickSlug,
  type KickChannelInfo,
} from "../kick/kickChannelLookup.js";
import { UserStore } from "./userStore.js";
import type { CreateUserInput, LoginInput, PublicUser, SignupInput } from "./types.js";
import { toPublicUser } from "./types.js";

export type KickLookup = (slug: string) => Promise<KickChannelInfo>;

export class AuthService {
  constructor(
    private readonly store = new UserStore(),
    private readonly resolveKick: KickLookup = lookupKickChannel
  ) {}

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

    let resolvedKick: KickChannelInfo;
    try {
      resolvedKick = await this.resolveKick(input.kickUsername);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not link Kick account. Check your Kick username and try again."
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.store.createUser(
      {
        username: input.username,
        email: input.email,
        kickUsername: normalizeKickSlug(resolvedKick.slug),
        kickChatroomId: resolvedKick.chatroomId,
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
