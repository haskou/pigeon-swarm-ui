import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

/** Signed community operation the node requires on every community mutation. */
export interface CommunityOperationBody {
  createdAt: number;
  /** The author identity key's signature of the operation id. */
  identitySignature: string;
  mutation: SignedPublicMutation;
  parents: string[];
}
