export interface KickChannelInfo {
  slug: string;
  chatroomId: number;
  displayName?: string;
}

export function normalizeKickSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/^@/, "");
}

export function validateKickSlug(slug: string): string | null {
  const normalized = normalizeKickSlug(slug);
  if (normalized.length < 2 || normalized.length > 25) {
    return "Kick username must be 2–25 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return "Kick username can only contain letters, numbers, and underscores.";
  }
  return null;
}

export function validateChatroomId(value: string | number): string | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return "Enter a valid Kick chatroom ID.";
  }
  return null;
}

export async function lookupKickChannel(
  slug: string
): Promise<KickChannelInfo> {
  const normalized = normalizeKickSlug(slug);
  const slugError = validateKickSlug(normalized);
  if (slugError) {
    throw new Error(slugError);
  }

  const response = await fetch(
    `https://kick.com/api/v2/channels/${encodeURIComponent(normalized)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Could not verify Kick account automatically. Enter your chatroom ID manually."
    );
  }

  const data = (await response.json()) as {
    slug?: string;
    user?: { username?: string };
    chatroom?: { id?: number };
  };

  const chatroomId = data.chatroom?.id;
  if (!chatroomId) {
    throw new Error("Kick account found, but chatroom ID was missing.");
  }

  return {
    slug: data.slug ?? normalized,
    chatroomId,
    displayName: data.user?.username,
  };
}

export function kickAccountsMatch(
  slug: string,
  chatroomId: number,
  resolved?: KickChannelInfo
): boolean {
  if (!resolved) {
    return true;
  }

  return (
    normalizeKickSlug(resolved.slug) === normalizeKickSlug(slug) &&
    resolved.chatroomId === chatroomId
  );
}
