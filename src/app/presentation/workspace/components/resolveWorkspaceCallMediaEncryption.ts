import type { CallMediaEncryptionUnavailableReason } from '../../../../contexts/calls/presentation/view-models/CallMediaEncryptionUnavailableReason';
import type { WorkspaceCallMediaEncryptionInput } from './WorkspaceCallMediaEncryptionInput';

import { CallPeerConnections } from '../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { CommunityOperationFold } from '../../../../contexts/communities/domain/operations/CommunityOperationFold';
import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';

export type WorkspaceCallMediaEncryption = {
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
};

/**
 * Whether the community's signed genesis makes it public. A community whose
 * signed operations cannot be read or folded counts as private, so a node
 * cannot make a call skip encryption by misreporting the visibility.
 */
async function isPublicCommunity(
  communityOperations: WorkspaceCallMediaEncryptionInput['communityOperations'],
  communityId: string,
): Promise<boolean> {
  try {
    return (
      CommunityOperationFold.fold(await communityOperations(communityId))
        ?.getVisibility()
        .isPublic() ?? false
    );
  } catch {
    return false;
  }
}

/**
 * Public community calls never use media E2EE. Every other call is private
 * and is refused, never downgraded, when this device cannot encrypt it.
 */
export async function resolveWorkspaceCallMediaEncryption({
  call,
  communityCallKey,
  communityOperations,
  currentIdentityId,
  keychain,
}: WorkspaceCallMediaEncryptionInput): Promise<WorkspaceCallMediaEncryption> {
  if (call.scope.type === 'community_channel') {
    const communityId = call.scope.communityId;

    if (await isPublicCommunity(communityOperations, communityId)) {
      return { mediaEncryptionUnavailableReason: 'public-community' };
    }

    if (!CallPeerConnections.mediaEncryptionSupported()) {
      throw new CallMediaEncryptionUnavailableError('unsupported');
    }

    try {
      return {
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

  return { mediaEncryptionKey: key };
}
