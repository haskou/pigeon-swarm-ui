import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface AcceptCommunityInviteLinkPort {
  acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community>;
}
