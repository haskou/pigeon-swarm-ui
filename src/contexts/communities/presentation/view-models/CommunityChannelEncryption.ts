import type { CommunityTextChannel } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';

export class CommunityChannelEncryption {
  public static missingCommunityKey({
    communityIsPublic,
    communityKey,
    owner,
    visibleMessages,
  }: {
    communityIsPublic: boolean;
    communityKey: unknown;
    owner: boolean;
    visibleMessages: { encrypted?: boolean }[];
  }): boolean {
    return (
      !communityIsPublic &&
      !communityKey &&
      (!owner ||
        (visibleMessages.length > 0 &&
          visibleMessages.every((message) => message.encrypted)))
    );
  }

  public static ready({
    communityIsPublic,
    communityKey,
    communityMemberIds,
    currentIdentityId,
    memberIdentities,
    selectedChannel,
  }: {
    communityIsPublic: boolean;
    communityKey: unknown;
    communityMemberIds: string[];
    currentIdentityId: string;
    memberIdentities: Record<string, unknown>;
    selectedChannel: CommunityTextChannel | undefined;
  }): boolean {
    return (
      !!selectedChannel &&
      (communityIsPublic ||
        (!!communityKey &&
          communityMemberIds.every(
            (identityId) =>
              identityId === currentIdentityId || memberIdentities[identityId],
          )))
    );
  }

  public static tooltip({
    communityIsPublic,
    ready,
  }: {
    communityIsPublic: boolean;
    ready: boolean;
  }): string {
    if (communityIsPublic) return copy.chat.publicChannel;

    return ready ? copy.chat.e2eReady : copy.chat.e2eMissing;
  }
}
