const maxRecentReactionEmojis = 6;

function storageKey(identityId: string): string {
  return `pigeon:recent-reaction-emojis:${identityId}`;
}

export function loadRecentReactionEmojis(identityId?: string): string[] {
  if (!identityId) return [];

  try {
    const parsed = JSON.parse(
      globalThis.localStorage?.getItem(storageKey(identityId)) ?? '[]',
    );

    return Array.isArray(parsed)
      ? parsed.filter((emoji): emoji is string => typeof emoji === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveRecentReactionEmoji(
  identityId: string | undefined,
  emoji: string,
): string[] {
  if (!identityId) return [];

  const next = [
    emoji,
    ...loadRecentReactionEmojis(identityId).filter((item) => item !== emoji),
  ].slice(0, maxRecentReactionEmojis);

  globalThis.localStorage?.setItem(
    storageKey(identityId),
    JSON.stringify(next),
  );

  return next;
}
