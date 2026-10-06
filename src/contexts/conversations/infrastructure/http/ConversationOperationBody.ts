// eslint-disable-next-line max-len
import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

/** Signed operation the node requires on every conversation mutation. */
export interface ConversationOperationBody {
  createdAt: number;
  mutation: SignedPublicMutation;
  parents: string[];
}
