import type { CommunityInvitationPayload } from '../../communities/application/communityResources.types';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type CommunityInvitationNotificationResource =
  BaseNotificationResource & {
    payload: CommunityInvitationPayload;
    type: 'community_invitation';
  };
