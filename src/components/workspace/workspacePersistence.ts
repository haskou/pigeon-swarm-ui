import type { ConversationResource } from '../../domain/types';

export type ConversationDrafts = Record<string, string>;
export type WorkspacePreference = {
  channelByCommunityId?: Record<string, string>;
  communityId?: null | string;
  mode?: 'community' | 'messages';
};
export type CommunityUnreadCounts = Record<string, Record<string, number>>;

export const lastConversationStorageKey = (identityId: string) =>
  `pigeon:lastConversation:${identityId}`;
export const draftsStorageKey = (identityId: string) =>
  `pigeon:conversationDrafts:${identityId}`;
export const workspaceStorageKey = (identityId: string) =>
  `pigeon:workspace:${identityId}`;
export const communityUnreadStorageKey = (identityId: string) =>
  `pigeon:communityUnread:${identityId}`;

export function initialConversationId(
  conversations: ConversationResource[],
  identityId: string,
): string | null {
  const storedId = globalThis.localStorage?.getItem(
    lastConversationStorageKey(identityId),
  );

  return conversations.some((conversation) => conversation.id === storedId)
    ? storedId
    : (conversations[0]?.id ?? null);
}

export function loadDrafts(identityId: string): ConversationDrafts {
  try {
    return JSON.parse(
      globalThis.localStorage?.getItem(draftsStorageKey(identityId)) ?? '{}',
    ) as ConversationDrafts;
  } catch {
    return {};
  }
}

export function loadWorkspacePreference(
  identityId: string,
): WorkspacePreference {
  try {
    return JSON.parse(
      globalThis.localStorage?.getItem(workspaceStorageKey(identityId)) ?? '{}',
    ) as WorkspacePreference;
  } catch {
    return {};
  }
}

export function loadCommunityUnreadCounts(
  identityId: string,
): CommunityUnreadCounts {
  try {
    return JSON.parse(
      globalThis.localStorage?.getItem(communityUnreadStorageKey(identityId)) ??
        '{}',
    ) as CommunityUnreadCounts;
  } catch {
    return {};
  }
}
