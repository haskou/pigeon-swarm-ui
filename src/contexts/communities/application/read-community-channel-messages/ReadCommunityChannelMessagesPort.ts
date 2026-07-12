import type {
  CommunityChannelMessagePinsResource,
  CommunityChannelDraft,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessagePage } from './CommunityChannelMessagePage';

export interface ReadCommunityChannelMessagesPort {
  listCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options?: { beforeMessageId?: string; limit?: number },
  ): Promise<CommunityChannelMessagePage>;
  listCommunityChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options?: { limit?: number },
  ): Promise<CommunityChannelMessagePage>;
  listCommunityChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource>;
  listCommunityDrafts(session: Session): Promise<CommunityChannelDraft[]>;
  searchCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<CommunityChannelMessagePage & { channelId?: string }>;
  searchCommunityMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<CommunityChannelMessagePage & { channelId?: string }>;
}
