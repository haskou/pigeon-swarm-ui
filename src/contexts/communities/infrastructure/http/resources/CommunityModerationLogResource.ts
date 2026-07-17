import type { PrimitiveOf } from '@haskou/value-objects';

import type { CommunityModerationAction } from '../../../domain/value-objects/CommunityModerationAction';
import type { CommunityModerationTargetType } from '../../../domain/value-objects/CommunityModerationTargetType';

export type CommunityModerationLogResource = {
  action: PrimitiveOf<CommunityModerationAction>;
  actorIdentityId: string;
  communityId: string;
  createdAt: number;
  details?: Record<string, unknown>;
  id: string;
  target: {
    id: string;
    type: PrimitiveOf<CommunityModerationTargetType>;
  };
};
