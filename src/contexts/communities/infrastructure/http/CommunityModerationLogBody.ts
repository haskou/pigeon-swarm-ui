import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

export interface CommunityModerationLogBody {
  createdAt: number;
  mutation: PublicMutation;
}
