import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

/** Signed operation the node requires on every conversation mutation. */
export interface ConversationOperationBody {
  createdAt: number;
  mutation: PublicMutation;
  parents: string[];
}
