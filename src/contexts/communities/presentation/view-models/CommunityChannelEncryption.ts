import type { CommunityTextChannel } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';

/** `checking` until the first synchronization of this device finishes. */
export type CommunityEncryptionState =
  | 'checking'
  | 'pending'
  | 'public'
  | 'ready';

export class CommunityChannelEncryption {
  public static awaitingGroupAccess(
    encryptionState: CommunityEncryptionState,
  ): boolean {
    return encryptionState === 'pending';
  }

  public static ready({
    communityMemberIds,
    currentIdentityId,
    encryptionState,
    memberIdentities,
    selectedChannel,
  }: {
    communityMemberIds: string[];
    currentIdentityId: string;
    encryptionState: CommunityEncryptionState;
    memberIdentities: Record<string, unknown>;
    selectedChannel: CommunityTextChannel | undefined;
  }): boolean {
    return (
      !!selectedChannel &&
      (encryptionState === 'public' ||
        (encryptionState === 'ready' &&
          communityMemberIds.every(
            (identityId) =>
              identityId === currentIdentityId || memberIdentities[identityId],
          )))
    );
  }

  public static tooltip({
    encryptionState,
    ready,
  }: {
    encryptionState: CommunityEncryptionState;
    ready: boolean;
  }): string {
    if (encryptionState === 'public') return copy.chat.publicChannel;

    return ready ? copy.chat.e2eReady : copy.chat.e2eMissing;
  }
}
