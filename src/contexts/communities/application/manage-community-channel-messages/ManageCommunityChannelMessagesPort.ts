import type {
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageEditInput } from '../../infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../../infrastructure/http/CommunityChannelMessageInput';

export interface ManageCommunityChannelMessagesPort {
  createCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource>;
  deleteCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void>;
  editCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    input: CommunityChannelMessageEditInput,
  ): Promise<MessageResource>;
  addCommunityChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;
  removeCommunityChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;
}
