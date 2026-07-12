import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';

import { readJsonObjectFromLocalStorage } from '../../../../shared/infrastructure/storage/jsonLocalStorage';

export type ConversationDrafts = Record<string, string>;
export type EncryptedConversationDrafts = {
  encryptedPayloads: Record<string, string>;
  version: 1;
};
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

export function encryptedDraftsStorageValue(
  encryptedPayloads: Record<string, string>,
): EncryptedConversationDrafts {
  return {
    encryptedPayloads,
    version: 1,
  };
}

export function loadLegacyPlainDrafts(identityId: string): ConversationDrafts {
  const stored = readJsonObjectFromLocalStorage<Record<string, unknown>>(
    draftsStorageKey(identityId),
    {},
  );

  if (isEncryptedConversationDrafts(stored)) return {};

  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export function loadEncryptedDraftPayloads(
  identityId: string,
): Record<string, string> {
  const stored = readJsonObjectFromLocalStorage<Record<string, unknown>>(
    draftsStorageKey(identityId),
    {},
  );

  if (!isEncryptedConversationDrafts(stored)) return {};

  return stored.encryptedPayloads;
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

function isEncryptedConversationDrafts(
  value: Record<string, unknown>,
): value is EncryptedConversationDrafts {
  return (
    value.version === 1 &&
    typeof value.encryptedPayloads === 'object' &&
    value.encryptedPayloads !== null &&
    !Array.isArray(value.encryptedPayloads) &&
    Object.values(value.encryptedPayloads).every(
      (payload) => typeof payload === 'string',
    )
  );
}
