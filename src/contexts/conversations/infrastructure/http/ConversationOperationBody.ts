import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

/** Signed conversation operation the node requires on every conversation mutation. */
export interface ConversationOperationBody {
  createdAt: number;
  mutation: SignedPublicMutation;
  parents: string[];
}
