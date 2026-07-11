import type {
  Community,
  CommunityChannel,
  CommunityChannelDraft,
  CommunityChannelMessagePinsResource,
  CommunityTextChannel,
  CommunityVoiceChannel,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageEditInput } from '../../infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../../infrastructure/http/CommunityChannelMessageInput';

export interface CommunityChannelPort {
  createCommunityTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel>;
  createCommunityVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel>;
  listCommunityChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]>;
  renameCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel>;
  deleteCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community>;
  updateCommunityChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel>;
  createCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource>;
  listCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options?: { beforeMessageId?: string; limit?: number },
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }>;
  listCommunityChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options?: { limit?: number },
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }>;
  listCommunityChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource>;
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
  listCommunityDrafts(session: Session): Promise<CommunityChannelDraft[]>;
  saveCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt?: number,
  ): Promise<CommunityChannelDraft>;
  deleteCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void>;
  searchCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }>;
  searchCommunityMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }>;
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
