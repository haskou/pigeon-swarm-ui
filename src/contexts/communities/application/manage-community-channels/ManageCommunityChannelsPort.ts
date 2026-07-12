import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityChannelsPort {
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
}
