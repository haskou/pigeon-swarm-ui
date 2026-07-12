import type {
  CommunityChannelDraft,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityChannelDraftsPort {
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
}
