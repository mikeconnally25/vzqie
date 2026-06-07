export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function safeCount(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

export function resolveMessageTimestamp(
  messageTimestamp: number,
  now = Date.now()
): number {
  if (
    Number.isFinite(messageTimestamp) &&
    messageTimestamp > 0 &&
    messageTimestamp <= now
  ) {
    return messageTimestamp;
  }
  return now;
}
