import {
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "./password.js";
import {
  lookupKickChannel,
  normalizeKickSlug,
  validateChatroomId,
  validateKickSlug,
  type KickChannelInfo,
} from "../kick/kickChannelLookup.js";
import { ViewerStore } from "./viewerStore.js";
import type {
  PublicViewer,
  ViewerLoginInput,
  ViewerSignupInput,
} from "./viewerTypes.js";
import { toPublicViewer } from "./viewerTypes.js";

export type KickLookup = (slug: string) => Promise<KickChannelInfo>;

export class ViewerService {
  constructor(
    private readonly store = new ViewerStore(),
    private readonly resolveKick: KickLookup = lookupKickChannel
  ) {}

  async signup(input: ViewerSignupInput): Promise<PublicViewer> {
    const kickSlugError = validateKickSlug(input.kickUsername);
    if (kickSlugError) {
      throw new Error(kickSlugError);
    }

    const passwordError = validatePassword(input.password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const emailError = validateEmail(input.email);
    if (emailError) {
      throw new Error(emailError);
    }

    const resolvedKick = await this.resolveKickAccount(input);

    const passwordHash = await hashPassword(input.password);
    const viewer = await this.store.createViewer(
      {
        kickUsername: normalizeKickSlug(resolvedKick.slug),
        kickChatroomId: resolvedKick.chatroomId,
        kickUserId: input.kickUserId,
        kickAccessToken: input.kickAccessToken,
        kickRefreshToken: input.kickRefreshToken,
        kickTokenExpiresAt: input.kickTokenExpiresAt,
        email: input.email,
      },
      passwordHash
    );
    return toPublicViewer(viewer);
  }

  async login(input: ViewerLoginInput): Promise<PublicViewer> {
    const kickSlugError = validateKickSlug(input.kickUsername);
    if (kickSlugError) {
      throw new Error("Invalid Kick username or password.");
    }

    const viewer = await this.store.findByKickUsername(input.kickUsername);
    if (!viewer) {
      throw new Error("Invalid Kick username or password.");
    }

    const valid = await verifyPassword(input.password, viewer.passwordHash);
    if (!valid) {
      throw new Error("Invalid Kick username or password.");
    }

    return toPublicViewer(viewer);
  }

  async getViewerById(id: string): Promise<PublicViewer | null> {
    const viewer = await this.store.findById(id);
    return viewer ? toPublicViewer(viewer) : null;
  }

  async countViewers(): Promise<number> {
    return this.store.count();
  }

  private async resolveKickAccount(
    input: ViewerSignupInput
  ): Promise<KickChannelInfo> {
    if (
      input.kickAccessToken &&
      input.kickUserId !== undefined &&
      input.kickChatroomId !== undefined
    ) {
      return {
        slug: normalizeKickSlug(input.kickUsername),
        chatroomId: input.kickChatroomId,
      };
    }

    if (input.kickChatroomId !== undefined) {
      const chatroomError = validateChatroomId(input.kickChatroomId);
      if (chatroomError) {
        throw new Error(chatroomError);
      }

      return {
        slug: normalizeKickSlug(input.kickUsername),
        chatroomId: input.kickChatroomId,
      };
    }

    try {
      return await this.resolveKick(input.kickUsername);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not link Kick account. Check your Kick username and try again."
      );
    }
  }
}
