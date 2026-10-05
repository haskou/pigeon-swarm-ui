import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

/** Signed community operation the node requires on every community mutation. */
export interface CommunityOperationBody {
  createdAt: number;
  mutation: SignedPublicMutation;
  parents: string[];
}
