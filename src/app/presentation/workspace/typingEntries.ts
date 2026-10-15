import type { DirectMessageTimelineChange } from '../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { RealtimeTypingInput } from '../../../shared/infrastructure/realtime/RealtimeGateway';

export type TypingEntries = Record<string, Record<string, number>>;

export function updateTypingEntries(
  entries: TypingEntries,
  scopeId: string,
  identityId: string,
  expiresAt: number | null,
): TypingEntries {
  const currentScope = entries[scopeId] ?? {};
  const nextScope = { ...currentScope };

  if (expiresAt === null) {
    delete nextScope[identityId];
  } else {
    nextScope[identityId] = expiresAt;
  }

  if (Object.keys(nextScope).length === 0) {
    const rest = { ...entries };
    delete rest[scopeId];

    return rest;
  }

  return { ...entries, [scopeId]: nextScope };
}

export function expireTypingEntries(entries: TypingEntries): TypingEntries {
  const now = Date.now();
  let changed = false;
  const nextEntries: TypingEntries = {};

  for (const [scopeId, scopeEntries] of Object.entries(entries)) {
    const activeEntries = Object.fromEntries(
      Object.entries(scopeEntries).filter(([, expiresAt]) => expiresAt > now),
    );

    if (
      Object.keys(activeEntries).length !== Object.keys(scopeEntries).length
    ) {
      changed = true;
    }

    if (Object.keys(activeEntries).length > 0) {
      nextEntries[scopeId] = activeEntries;
    }
  }

  return changed ? nextEntries : entries;
}

export function activeTypingIdentityIds(
  entries: TypingEntries,
  scopeId: string | null | undefined,
): string[] {
  if (!scopeId) return [];

  const now = Date.now();

  return Object.entries(entries[scopeId] ?? {})
    .filter(([, expiresAt]) => expiresAt > now)
    .map(([identityId]) => identityId)
    .sort();
}

export function communityTypingKey(
  communityId: string,
  channelId: string,
): string {
  return `${communityId}:${channelId}`;
}

export function typingInputKey(input: RealtimeTypingInput): string {
  return input.scope === 'conversation'
    ? `conversation:${input.conversationId}`
    : communityTypingKey(input.communityId, input.channelId);
}

const GROUP_TYPING_MS = 15_000;

/**
 * Folds a group conversation's synced changes into the typing entries, in
 * inbox order: a typing notice shows its author until 15 seconds after it
 * was written, never longer than 15 seconds from now; a message from the
 * author ends it.
 */
export function applyGroupTypingChanges(
  entries: TypingEntries,
  conversationId: string,
  changes: DirectMessageTimelineChange[],
  now: number,
): TypingEntries {
  return changes.reduce((current, change) => {
    if (change.kind === 'message') {
      const { authorIdentityId } = change.message;

      return current[conversationId]?.[authorIdentityId] === undefined
        ? current
        : updateTypingEntries(current, conversationId, authorIdentityId, null);
    }

    if (change.kind !== 'typing') return current;
    const expiresAt = Math.min(change.createdAt, now) + GROUP_TYPING_MS;

    return expiresAt > now
      ? updateTypingEntries(
          current,
          conversationId,
          change.identityId,
          expiresAt,
        )
      : current;
  }, entries);
}
