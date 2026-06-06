import type { CommunityInvitationPayload } from '../../communities/domain/communityResources.types';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type CommunityInvitationNotificationResource =
  BaseNotificationResource & {
    payload: CommunityInvitationPayload;
    type: 'community_invitation';
  };
