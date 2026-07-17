import type { CommunityModerationAction } from '../../domain/CommunityModerationAction';
import type { CommunityModerationTargetType } from '../../domain/CommunityModerationTargetType';

export type CommunityModerationLogResource = {
  action: CommunityModerationAction;
  actorIdentityId: string;
  communityId: string;
  createdAt: number;
  details?: Record<string, unknown>;
  id: string;
  target: {
    id: string;
    type: CommunityModerationTargetType;
  };
};
