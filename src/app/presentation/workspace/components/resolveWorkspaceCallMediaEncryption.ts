import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallMediaEncryptionUnavailableReason } from '../../../../contexts/calls/presentation/view-models/CallMediaEncryptionUnavailableReason';
import type {
  Community,
  ConversationKeyEntry,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';

export type WorkspaceCallMediaEncryption = {
  mediaEncryptionEnabled: boolean;
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
};

type WorkspaceCallMediaEncryptionInput = {
  call: CallResource;
  communities: Community[];
  currentIdentityId: string;
  enabled: boolean;
  keychain: LocalKeychain;
};

export function resolveWorkspaceCallMediaEncryption({
  call,
  communities,
  currentIdentityId,
  enabled,
  keychain,
}: WorkspaceCallMediaEncryptionInput): WorkspaceCallMediaEncryption {
  const unavailable = (reason: CallMediaEncryptionUnavailableReason) => ({
    mediaEncryptionEnabled: enabled,
    mediaEncryptionUnavailableReason: reason,
  });
  const available = (entry: ConversationKeyEntry | undefined) =>
    entry?.key
      ? { mediaEncryptionEnabled: enabled, mediaEncryptionKey: entry.key }
      : unavailable('missing-key');

  if (call.scope.type === 'community_channel') {
    const communityId = call.scope.communityId;
    const community = communities.find((item) => item.id === communityId);

    if (community?.visibility === 'public') {
      return unavailable('public-community');
    }

    return available(keychain.conversations[communityId]);
  }

  return available(
    ConversationKeychain.entry(
      keychain,
      currentIdentityId,
      call.scope.conversationId,
    ),
  );
}
