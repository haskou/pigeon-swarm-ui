import type { CallMediaEncryptionUnavailableReason } from '../../../../contexts/calls/presentation/view-models/CallMediaEncryptionUnavailableReason';
import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { WorkspaceCallMediaEncryptionInput } from './WorkspaceCallMediaEncryptionInput';

import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';

export type WorkspaceCallMediaEncryption = {
  mediaEncryptionEnabled: boolean;
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
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
