import type { CommunityModerationAction } from './CommunityModerationAction';
import type { CommunityModerationTargetType } from './CommunityModerationTargetType';

export type CommunityModerationLog = {
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
