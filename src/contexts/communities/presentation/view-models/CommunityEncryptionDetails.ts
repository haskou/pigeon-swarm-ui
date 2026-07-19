import type { EncryptionDetails } from '../../../../app/presentation/workspace/components/EncryptionDetailsDialog';
import type {
  Community,
  CommunityTextChannel,
  ConversationKeyEntry,
} from '../../../../shared/domain/pigeonResources.types';

import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

type CommunityEncryptionDetailsInput = {
  channelEncryptionReady: boolean;
  community: Community;
  communityIsPublic: boolean;
  communityKey?: ConversationKeyEntry;
  networkName: string;
  selectedChannel?: CommunityTextChannel;
};

export class CommunityEncryptionDetails {
  public static create({
    channelEncryptionReady,
    community,
    communityIsPublic,
    communityKey,
    networkName,
    selectedChannel,
  }: CommunityEncryptionDetailsInput): EncryptionDetails {
    return {
      note: CommunityEncryptionDetails.note(
        communityIsPublic,
        channelEncryptionReady,
      ),
      rows: [
        {
          label: copy.encryption.scope,
          value: selectedChannel
            ? `${community.name} / #${selectedChannel.name}`
            : community.name,
        },
        { label: copy.encryption.network, value: networkName },
        {
          label: copy.encryption.algorithm,
          technical: true,
          value: communityIsPublic
            ? copy.encryption.plaintext
            : (communityKey?.algorithm ?? copy.encryption.unknown),
        },
        {
          label: copy.encryption.keyVersion,
          technical: true,
          value: communityKey ? `v${communityKey.version}` : '-',
        },
        {
          label: copy.encryption.createdAt,
          technical: true,
          value: CommunityEncryptionDetails.createdAt(communityKey),
        },
      ],
      secrets: communityIsPublic
        ? []
        : [
            {
              label: copy.encryption.communityKey,
              sensitive: true,
              value: communityKey?.key,
            },
          ],
      status: CommunityEncryptionDetails.status(
        communityIsPublic,
        channelEncryptionReady,
      ),
      subtitle: shortId(selectedChannel?.id ?? community.id),
      title: copy.encryption.communityTitle,
    };
  }

  private static createdAt(key?: ConversationKeyEntry): string {
    if (!key) return '-';

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(key.createdAt));
  }

  private static note(
    communityIsPublic: boolean,
    channelEncryptionReady: boolean,
  ): string {
    if (communityIsPublic) return copy.encryption.publicCommunityNote;

    return channelEncryptionReady
      ? copy.encryption.communityNote
      : copy.encryption.missingNote;
  }

  private static status(
    communityIsPublic: boolean,
    channelEncryptionReady: boolean,
  ): EncryptionDetails['status'] {
    if (communityIsPublic) return 'public';

    return channelEncryptionReady ? 'ready' : 'missing';
  }
}
