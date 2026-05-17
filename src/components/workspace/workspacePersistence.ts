import type { ConversationResource } from '../../domain/types';

import { readJsonObjectFromLocalStorage } from '../../infrastructure/storage/JsonLocalStorage';

export type ConversationDrafts = Record<string, string>;
export type WorkspacePreference = {
  channelByCommunityId?: Record<string, string>;
  communityId?: null | string;
  mode?: 'community' | 'messages';
};
export type CommunityUnreadCounts = Record<string, Record<string, number>>;

export const lastConversationStorageKey = (identityId: string): string =>
  `pigeon:lastConversation:${identityId}`;
export const draftsStorageKey = (identityId: string): string =>
  `pigeon:conversationDrafts:${identityId}`;
export const workspaceStorageKey = (identityId: string): string =>
  `pigeon:workspace:${identityId}`;
export const communityUnreadStorageKey = (identityId: string): string =>
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
  return readJsonObjectFromLocalStorage(draftsStorageKey(identityId), {});
}

export function loadWorkspacePreference(
  identityId: string,
): WorkspacePreference {
  return readJsonObjectFromLocalStorage(workspaceStorageKey(identityId), {});
}

export function loadCommunityUnreadCounts(
  identityId: string,
): CommunityUnreadCounts {
  return readJsonObjectFromLocalStorage(
    communityUnreadStorageKey(identityId),
    {},
  );
}
