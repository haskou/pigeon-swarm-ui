import type { EncryptionDetails } from '../../../../app/presentation/workspace/components/EncryptionDetails';
import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';
import type { CommunityTextChannelResource as CommunityTextChannel } from '../../infrastructure/http/resources/CommunityTextChannelResource';

import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

type CommunityEncryptionDetailsInput = {
  channelEncryptionReady: boolean;
  community: Community;
  communityIsPublic: boolean;
  networkName: string;
  selectedChannel?: CommunityTextChannel;
};

export class CommunityEncryptionDetails {
  public static create({
    channelEncryptionReady,
    community,
    communityIsPublic,
    networkName,
    selectedChannel,
  }: CommunityEncryptionDetailsInput): EncryptionDetails {
    return {
      identifiers: [
        { label: copy.encryption.communityId, value: community.id },
        ...(selectedChannel
          ? [{ label: copy.encryption.channelId, value: selectedChannel.id }]
          : []),
      ],
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
            : copy.encryption.mlsCiphersuite,
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
