import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

export interface CommunityModerationLogBody {
  createdAt: number;
  mutation: SignedPublicMutation;
}
