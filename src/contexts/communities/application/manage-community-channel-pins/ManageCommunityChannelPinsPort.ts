import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityChannelPinsPort {
  pinCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void>;
  unpinCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void>;
}
