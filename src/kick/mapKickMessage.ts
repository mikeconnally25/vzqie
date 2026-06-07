import type { ChatMessage } from "../types.js";

export interface KickChatMessageEvent {
  content: string;
  created_at: string;
  sender: {
    username: string;
    identity?: {
      badges?: Array<string | { type?: string }>;
    };
  };
}

const EMOTE_PATTERN = /\[emote:\d+:[^\]]+\]/g;

export function stripKickEmotes(content: string): string {
  return content.replace(EMOTE_PATTERN, "").trim();
}

function badgeTypes(
  badges: Array<string | { type?: string }> | undefined
): string[] {
  if (!badges) {
    return [];
  }

  return badges.map((badge) =>
    typeof badge === "string" ? badge : (badge.type ?? "")
  );
}

export function mapKickMessage(event: KickChatMessageEvent): ChatMessage {
  const types = badgeTypes(event.sender.identity?.badges);

  return {
    username: event.sender.username,
    message: stripKickEmotes(event.content),
    timestamp: Date.parse(event.created_at),
    isSubscriber: types.includes("subscriber"),
    isFollower: types.includes("follower") || types.includes("founder"),
  };
}
