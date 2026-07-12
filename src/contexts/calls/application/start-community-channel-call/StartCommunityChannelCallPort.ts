import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../../domain/callSession.types';

export interface StartCommunityChannelCallPort {
  startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource>;
}
