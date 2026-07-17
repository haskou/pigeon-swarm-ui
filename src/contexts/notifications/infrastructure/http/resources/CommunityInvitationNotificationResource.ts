import type { CommunityInvitationPayloadResource as CommunityInvitationPayload } from '../../../../communities/infrastructure/http/resources/CommunityInvitationPayloadResource';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type CommunityInvitationNotificationResource =
  BaseNotificationResource & {
    payload: CommunityInvitationPayload;
    type: 'community_invitation';
  };
