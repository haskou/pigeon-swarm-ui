import type { NodeBlockExceptionsPrimitives } from '../../domain/NodeBlockExceptions';
import type { NodeBlockListPrimitives } from '../../domain/NodeBlockList';
import type { NodeBlockSourcePrimitives } from '../../domain/NodeBlockSource';
import type { NodeRegistrationCodePrimitives } from '../../domain/NodeRegistrationCode';
import type { PendingNodeBlockEntriesPrimitives } from '../../domain/PendingNodeBlockEntries';
import type { NodeRegistrationModeValue } from '../../domain/value-objects/NodeRegistrationMode';

export type NodeRegistrationModeViewModel = NodeRegistrationModeValue;

export type NodeRegistrationCodeViewModel = NodeRegistrationCodePrimitives;

/** Holds the secret code, which the node returns only once. */
export interface IssuedNodeRegistrationCodeViewModel extends NodeRegistrationCodeViewModel {
  code: string;
}

export type NodeBlockListViewModel = NodeBlockListPrimitives;

export type NodeBlockSourceViewModel = NodeBlockSourcePrimitives;

export type PendingNodeBlockEntriesViewModel =
  PendingNodeBlockEntriesPrimitives;

export type NodeBlockExceptionsViewModel = Omit<
  NodeBlockExceptionsPrimitives,
  'nodeId'
>;

/** An identity id, or else a node peer id. */
export interface NodeBlockTargetViewModel {
  identityId?: string;
  nodePeerId?: string;
}
