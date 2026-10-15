import type { CallMediaEncryptionUnavailableReason } from '../../../../contexts/calls/presentation/view-models/CallMediaEncryptionUnavailableReason';
import type { WorkspaceCallMediaEncryptionInput } from './WorkspaceCallMediaEncryptionInput';

import { CallPeerConnections } from '../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';

export type WorkspaceCallMediaEncryption = {
  mediaEncryptionEnabled: boolean;
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
};

/**
 * Public community calls never use media E2EE. Every other call is private
 * and is refused, never downgraded, when this device cannot encrypt it.
 */
export async function resolveWorkspaceCallMediaEncryption({
  call,
  communities,
  communityCallKey,
  currentIdentityId,
  enabled,
  keychain,
}: WorkspaceCallMediaEncryptionInput): Promise<WorkspaceCallMediaEncryption> {
  if (call.scope.type === 'community_channel') {
    const communityId = call.scope.communityId;
    const community = communities.find((item) => item.id === communityId);

    if (community?.visibility === 'public') {
      return {
        mediaEncryptionEnabled: enabled,
        mediaEncryptionUnavailableReason: 'public-community',
      };
    }

    if (!CallPeerConnections.mediaEncryptionSupported()) {
      throw new CallMediaEncryptionUnavailableError('unsupported');
    }

    try {
      return {
        mediaEncryptionEnabled: enabled,
        mediaEncryptionKey: await communityCallKey(communityId, call.id),
      };
    } catch {
      throw new CallMediaEncryptionUnavailableError('missing-key');
    }
  }

  if (!CallPeerConnections.mediaEncryptionSupported()) {
    throw new CallMediaEncryptionUnavailableError('unsupported');
  }

  const key = ConversationKeychain.entry(
    keychain,
    currentIdentityId,
    call.scope.conversationId,
  )?.key;

  if (!key) throw new CallMediaEncryptionUnavailableError('missing-key');

  return { mediaEncryptionEnabled: enabled, mediaEncryptionKey: key };
}
