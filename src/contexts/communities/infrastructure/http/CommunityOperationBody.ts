import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

/** Signed community operation the node requires on every community mutation. */
export interface CommunityOperationBody {
  createdAt: number;
  /** The author identity key's signature of the operation id. */
  identitySignature: string;
  mutation: PublicMutation;
  parents: string[];
}
