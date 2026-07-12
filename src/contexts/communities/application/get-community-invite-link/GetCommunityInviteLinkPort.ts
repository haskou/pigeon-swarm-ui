import type { CommunityInviteLinkResource } from '../../../../shared/domain/pigeonResources.types';

export interface GetCommunityInviteLinkPort {
  getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource>;
}
