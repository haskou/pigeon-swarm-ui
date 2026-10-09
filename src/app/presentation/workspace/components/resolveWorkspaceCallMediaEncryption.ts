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
  communityCallKey: (communityId: string, callId: string) => Promise<string>;
  enabled: boolean;
  keychain: LocalKeychain;
};

export async function resolveWorkspaceCallMediaEncryption({
  call,
  communities,
  communityCallKey,
  currentIdentityId,
  enabled,
  keychain,
}: WorkspaceCallMediaEncryptionInput): Promise<WorkspaceCallMediaEncryption> {
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

    try {
      return {
        mediaEncryptionEnabled: enabled,
        mediaEncryptionKey: await communityCallKey(communityId, call.id),
      };
    } catch {
      return unavailable('missing-key');
    }
  }

  return available(
    ConversationKeychain.entry(
      keychain,
      currentIdentityId,
      call.scope.conversationId,
    ),
  );
}
